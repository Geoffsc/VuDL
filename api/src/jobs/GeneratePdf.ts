import { Job as QueueJob } from "bullmq";
import fs = require("fs");
import Config from "../models/Config";
import { FedoraObject } from "../models/FedoraObject";
import { execSync } from "child_process";
import FedoraObjectFactory from "../services/FedoraObjectFactory";
import http = require("needle");
import PDFDocument = require("pdfkit");
import QueueJobInterface from "./QueueJobInterface";
import tmp = require("tmp");
import FedoraDataCollector from "../services/FedoraDataCollector";

export class PdfGenerator {
    protected pid: string;
    protected config: Config;
    protected objectFactory: FedoraObjectFactory;
    protected fedoraDataCollector: FedoraDataCollector;

    constructor(
        pid: string,
        config: Config,
        objectFactory: FedoraObjectFactory,
        fedoraDataCollector: FedoraDataCollector,
    ) {
        this.pid = pid;
        this.config = config;
        this.objectFactory = objectFactory;
        this.fedoraDataCollector = fedoraDataCollector;
    }

    public static build(pid: string): PdfGenerator {
        return new PdfGenerator(
            pid,
            Config.getInstance(),
            FedoraObjectFactory.getInstance(),
            FedoraDataCollector.getInstance(),
        );
    }

    private hasPdfAlready(manifest): boolean {
        const rendering = (((manifest ?? {}).sequences ?? [])[0] ?? {}).rendering ?? [];
        if (rendering.length === 0) {
            return false;
        }
        const renderingFormats = rendering.map((current) => {
            return current.format ?? "";
        });
        return renderingFormats.includes("application/pdf");
    }

    private getLargeJpegs(manifest): string[] {
        const canvases = (((manifest ?? {}).sequences ?? [])[0] ?? {}).canvases ?? [];
        return canvases.map((current) => {
            return current.images[0].resource["@id"];
        });
    }

    private async generatePdf(jpegs: string[]): Promise<string> {
        const tmpobj = tmp.fileSync();
        const pdf = tmpobj.name;
        const pdfObj = new PDFDocument({ autoFirstPage: false });
        const stream = fs.createWriteStream(pdf);
        pdfObj.pipe(stream);
        for (const jpeg of jpegs) {
            const pageTmp = tmp.fileSync();
            const pageFile = pageTmp.name;
            const response = await http("get", jpeg);
            if (response.statusCode !== 200) {
                const msg = "Unexpected status code (" + response.statusCode + ") for " + jpeg;
                console.error(msg);
                throw new Error(msg);
            }
            fs.writeFileSync(pageFile, response.body);
            const img = pdfObj.openImage(pageFile);
            pdfObj.addPage({ size: [img.width, img.height] }).image(img, 0, 0);
            fs.truncateSync(pageFile, 0);
            fs.rmSync(pageFile);
        }
        pdfObj.end();
        // Wait for the PDF to finish generating (i.e. for the write stream to be closed):
        await new Promise<void>((resolve) => {
            stream.on("finish", function () {
                resolve();
            });
        });

        // Now apply OCR:
        const ocrmypdf = this.config.ocrmypdfPath;
        if (ocrmypdf) {
            const ocrmypdfCommand = ocrmypdf + " " + pdf + " " + pdf;
            execSync(ocrmypdfCommand);
        }

        return pdf;
    }

    private async addPdfToPid(pdf: string, state: string): Promise<void> {
        const documentList = await this.objectFactory.build("ListCollection", "Document List", state, this.pid);
        const pdfObject = await this.buildDocument(documentList, 1, state);
        await this.addDatastreamsToDocument(pdf, pdfObject);
    }

    private async buildDocument(documentList: FedoraObject, number: number, state: string): Promise<FedoraObject> {
        const documentData = await this.objectFactory.build("PDFData", "PDF", state, documentList.pid);
        await documentData.addSequenceRelationship(documentList.pid, number);
        return documentData;
    }

    private async addDatastreamsToDocument(pdf: string, documentData: FedoraObject): Promise<void> {
        await documentData.addDatastreamFromFile(pdf, "MASTER", "application/pdf");
    }

    async run(): Promise<void> {
        const manifestUrl = this.config.vufindUrl + "/Item/" + this.pid + "/Manifest";
        const response = await http("get", manifestUrl);
        if (response.statusCode !== 200) {
            const msg = "Unexpected " + response.statusCode + " status for " + manifestUrl;
            console.error(msg);
            throw new Error(msg);
        }
        const manifest = response.body;
        if (this.hasPdfAlready(manifest)) {
            console.log(this.pid + " already has a PDF; exiting early.");
            return;
        }
        const largeJpegs = this.getLargeJpegs(manifest);
        if (largeJpegs.length == 0) {
            console.log(this.pid + " contains no images; exiting early.");
            return;
        }
        const pdf = await this.generatePdf(largeJpegs);
        // Look up parent object state so newly-generated objects can match it:
        const fedoraData = await this.fedoraDataCollector.getObjectData(this.pid);
        await this.addPdfToPid(pdf, fedoraData.state);
        fs.truncateSync(pdf, 0);
        fs.rmSync(pdf);
    }
}

class GeneratePdf implements QueueJobInterface {
    async run(job: QueueJob): Promise<void> {
        const handler = PdfGenerator.build(job.data.pid);
        await handler.run();
    }
}

export default GeneratePdf;
