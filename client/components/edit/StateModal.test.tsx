import React from "react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { act } from "react-dom/test-utils";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import renderer from "react-test-renderer";
import StateModal from "./StateModal";

const mockUseGlobalContext = jest.fn();
jest.mock("../../context/GlobalContext", () => ({
    useGlobalContext: () => {
        return mockUseGlobalContext();
    },
}));

const mockUseEditorContext = jest.fn();
jest.mock("../../context/EditorContext", () => ({
    useEditorContext: () => {
        return mockUseEditorContext();
    },
}));

const mockUseFetchContext = jest.fn();
jest.mock("../../context/FetchContext", () => ({
    useFetchContext: () => {
        return mockUseFetchContext();
    },
}));

jest.mock("./ObjectLoader", () => (args) => JSON.stringify(args));

jest.mock(
    "@mui/material/Dialog",
    () =>
        function MockDialog(props: { open: boolean; children: unknown }) {
            return (
                <>
                    {"Dialog"}
                    {props.open ? "open" : "closed"}
                    {props.children}
                </>
            );
        },
);
jest.mock("@mui/material/DialogTitle", () => (props) => props.children);
jest.mock("@mui/material/DialogContent", () => (props) => props.children);
jest.mock("@mui/material/Grid", () => (props) => props.children);
jest.mock("@mui/icons-material/Close", () => () => "CloseIcon");

describe("StateModal", () => {
    let globalValues;
    let editorValues;
    let fetchContextValues;
    const pid = "foo:123";
    beforeEach(() => {
        globalValues = {
            action: {
                closeModal: jest.fn(),
                isModalOpen: jest.fn(),
                openModal: jest.fn(),
                setSnackbarState: jest.fn(),
            },
        };
        editorValues = {
            state: {
                stateModalActivePid: pid,
                objectDetailsStorage: {},
            },
            action: {
                updateObjectState: jest.fn(),
            },
        };
        fetchContextValues = {
            action: {
                fetchJSON: jest.fn(),
            },
        };
        mockUseGlobalContext.mockReturnValue(globalValues);
        mockUseEditorContext.mockReturnValue(editorValues);
        mockUseFetchContext.mockReturnValue(fetchContextValues);
        globalValues.action.isModalOpen.mockReturnValue(true);
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("renders correctly when closed", () => {
        globalValues.action.isModalOpen.mockReturnValue(false);
        let tree;
        renderer.act(() => {
            tree = renderer.create(<StateModal />);
        });
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it("renders correctly for a pending object", () => {
        let tree;
        renderer.act(() => {
            tree = renderer.create(<StateModal />);
        });
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it("renders correctly for a loaded object with children", async () => {
        editorValues.state.objectDetailsStorage[pid] = { pid, state: "Active" };
        fetchContextValues.action.fetchJSON.mockResolvedValue({ numFound: 100 });
        let tree;
        await renderer.act(async () => {
            tree = renderer.create(<StateModal />);
        });
        await waitFor(() => expect(fetchContextValues.action.fetchJSON).toHaveBeenCalled());
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it("renders correctly for a loaded object without children", async () => {
        editorValues.state.objectDetailsStorage[pid] = { pid, state: "Active" };
        fetchContextValues.action.fetchJSON.mockResolvedValue({ numFound: 0 });
        let tree;
        await renderer.act(async () => {
            tree = renderer.create(<StateModal />);
        });
        await waitFor(() => expect(fetchContextValues.action.fetchJSON).toHaveBeenCalled());
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        expect(tree.toJSON()).toMatchSnapshot();
    });

    it("saves data correctly", async () => {
        editorValues.state.objectDetailsStorage[pid] = { pid, state: "Inactive" };
        editorValues.action.updateObjectState.mockResolvedValue(["Status saved successfully.", "success"]);
        fetchContextValues.action.fetchJSON.mockResolvedValue({ numFound: 0 });
        await act(async () => {
            render(<StateModal />);
        });
        await waitFor(() => expect(fetchContextValues.action.fetchJSON).toHaveBeenCalled());
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        const user = userEvent.setup();
        await user.click(screen.getByText("Active"));
        await user.click(screen.getByText("Save"));
        await waitFor(() =>
            expect(editorValues.action.updateObjectState).toHaveBeenCalledWith(
                "foo:123",
                "Active",
                0,
                expect.anything(),
            ),
        );
        expect(globalValues.action.setSnackbarState).toHaveBeenCalledWith({
            message: "Status saved successfully.",
            open: true,
            severity: "success",
        });
        expect(globalValues.action.closeModal).toHaveBeenCalledWith("state");
    });

    it("does not save when nothing changes", async () => {
        editorValues.state.objectDetailsStorage[pid] = { pid, state: "Inactive" };
        fetchContextValues.action.fetchJSON.mockResolvedValue({ numFound: 0 });
        await act(async () => {
            render(<StateModal />);
        });
        await waitFor(() => expect(fetchContextValues.action.fetchJSON).toHaveBeenCalled());
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        await userEvent.setup().click(screen.getByText("Save"));
        await waitFor(() =>
            expect(globalValues.action.setSnackbarState).toHaveBeenCalledWith({
                message: "No changes were made.",
                open: true,
                severity: "info",
            }),
        );
        expect(editorValues.action.updateObjectState).not.toHaveBeenCalled();
        expect(globalValues.action.openModal).not.toHaveBeenCalled();
    });

    it("handles save failure gracefully", async () => {
        editorValues.state.objectDetailsStorage[pid] = { pid, state: "Inactive" };
        fetchContextValues.action.fetchJSON.mockResolvedValue({ numFound: 0 });
        editorValues.action.updateObjectState.mockImplementation(() => {
            throw new Error('Status failed to save; "not ok"');
        });
        await act(async () => {
            render(<StateModal />);
        });
        await waitFor(() => expect(fetchContextValues.action.fetchJSON).toHaveBeenCalled());
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        const user = userEvent.setup();
        await user.click(screen.getByText("Active"));
        await user.click(screen.getByText("Save"));
        await waitFor(() =>
            expect(editorValues.action.updateObjectState).toHaveBeenCalledWith(
                "foo:123",
                "Active",
                0,
                expect.anything(),
            ),
        );
        expect(globalValues.action.setSnackbarState).toHaveBeenCalledWith({
            message: 'Status failed to save; "not ok"',
            open: true,
            severity: "error",
        });
        expect(globalValues.action.closeModal).toHaveBeenCalledWith("state");
    });

    it("updates children correctly", async () => {
        editorValues.state.objectDetailsStorage[pid] = { pid, state: "Inactive" };
        fetchContextValues.action.fetchJSON.mockResolvedValue({ numFound: 1, docs: [{ id: "foo:125" }] });
        editorValues.action.updateObjectState.mockResolvedValue(["Status saved successfully.", "success"]);
        await act(async () => {
            render(<StateModal />);
        });
        await waitFor(() => expect(fetchContextValues.action.fetchJSON).toHaveBeenCalled());
        expect(globalValues.action.isModalOpen).toHaveBeenCalledWith("state");
        const user = userEvent.setup();
        await user.click(screen.getByText("Active"));
        await user.click(screen.getByText("Update 1 children to match"));
        await user.click(screen.getByText("Save"));
        await waitFor(() =>
            expect(editorValues.action.updateObjectState).toHaveBeenCalledWith(
                "foo:123",
                "Active",
                1,
                expect.anything(),
            ),
        );
        expect(globalValues.action.setSnackbarState).toHaveBeenCalledWith({
            message: "Status saved successfully.",
            open: true,
            severity: "success",
        });
        expect(globalValues.action.closeModal).toHaveBeenCalledWith("state");
    });
});
