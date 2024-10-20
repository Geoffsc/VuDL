import React, { createContext, useContext, useReducer } from "react";
import {
    editObjectCatalogUrl,
    getMoveToParentUrl,
    getObjectChildCountsUrl,
    getObjectChildrenUrl,
    getObjectDetailsUrl,
    getObjectParentsUrl,
    getObjectRecursiveChildPidsUrl,
    getObjectStateUrl,
    getParentUrl,
} from "../util/routes";
import { useFetchContext } from "./FetchContext";
import { extractFirstMetadataValue as utilExtractFirstMetadataValue } from "../util/metadata";
import { TreeNode } from "../util/Breadcrumbs";

export interface ObjectDetails {
    fedoraDatastreams: Array<string>;
    metadata: Record<string, Array<string>>;
    models: Array<string>;
    pid: string;
    sortOn: string;
    state: string;
};

interface ChildrenResultPage {
    numFound?: number;
    start?: number;
    docs?: Record<string, string|string[]>[];
}

export interface FedoraDatastream {
    mimetype?: {
        allowedType: string;
        allowedSubtypes: string;
    };
}

export interface FedoraModel {
    datastreams?: Record<string, FedoraDatastream>;
}

export interface License {
    name: string;
    uri: string;
}

export interface ChildCounts {
    directChildren: number;
    totalDescendants: number;
}

interface EditorState {
    modelsCatalog: Record<string, FedoraModel>;
    licensesCatalog: Record<string, License>;
    agentsCatalog: Record<string, Object>;
    dublinCoreFieldCatalog: Record<string, Record<string, string>>;
    favoritePidsCatalog: Record<string, string>;
    trashPid: string | null;
    processMetadataDefaults: Record<string, string>;
    toolPresets: Array<Record<string, string>>;
    vufindUrl: string;
    currentAgents: Array<Object>;
    currentPid: string | null;
    activeDatastream: string | null;
    isDatastreamModalOpen: boolean;
    isParentsModalOpen: boolean;
    isStateModalOpen: boolean;
    datastreamModalState: string | null;
    parentsModalActivePid: string | null;
    stateModalActivePid: string | null;
    objectDetailsStorage: Record<string, ObjectDetails>;
    parentDetailsStorage: Record<string, Record<string, TreeNode>>;
    childCountsStorage: Record<string, ChildCounts>;
    childListStorage: Record<string, ChildrenResultPage>;
    topLevelPids: Array<string>;
}

/**
 * Pass a shared entity to react components,
 * specifically a way to make api requests.
 */
const editorContextParams: EditorState = {
    modelsCatalog: {},
    licensesCatalog: {},
    agentsCatalog: {},
    dublinCoreFieldCatalog: {},
    favoritePidsCatalog: {},
    trashPid: null,
    processMetadataDefaults: {},
    toolPresets: [],
    vufindUrl: "",
    currentAgents: [],
    currentPid: null,
    activeDatastream: null,
    isDatastreamModalOpen: false,
    isParentsModalOpen: false,
    isStateModalOpen: false,
    datastreamModalState: null,
    parentsModalActivePid: null,
    stateModalActivePid: null,
    objectDetailsStorage: {},
    parentDetailsStorage: {},
    childCountsStorage: {},
    childListStorage: {},
    topLevelPids: [],
};

export const DatastreamModalStates = {
    UPLOAD: "Upload",
    VIEW: "View",
    METADATA: "Metadata",
    DOWNLOAD: "Download",
    DELETE: "Delete"
};


const EditorContext = createContext({});

const reducerMapping: Record<string, string> = {
    SET_AGENTS_CATALOG: "agentsCatalog",
    SET_DUBLIN_CORE_FIELD_CATALOG: "dublinCoreFieldCatalog",
    SET_FAVORITE_PIDS_CATALOG: "favoritePidsCatalog",
    SET_TRASH_PID: "trashPid",
    SET_PROCESS_METADATA_DEFAULTS: "processMetadataDefaults",
    SET_TOOL_PRESETS: "toolPresets",
    SET_VUFIND_URL: "vufindUrl",
    SET_LICENSES_CATALOG: "licensesCatalog",
    SET_MODELS_CATALOG: "modelsCatalog",
    SET_CURRENT_AGENTS: "currentAgents",
    SET_CURRENT_PID: "currentPid",
    SET_ACTIVE_DATASTREAM: "activeDatastream",
    SET_IS_DATASTREAM_MODAL_OPEN: "isDatastreamModalOpen",
    SET_IS_PARENTS_MODAL_OPEN: "isParentsModalOpen",
    SET_IS_STATE_MODAL_OPEN: "isStateModalOpen",
    SET_DATASTREAM_MODAL_STATE: "datastreamModalState",
    SET_PARENTS_MODAL_ACTIVE_PID: "parentsModalActivePid",
    SET_STATE_MODAL_ACTIVE_PID: "stateModalActivePid",
    SET_TOP_LEVEL_PIDS: "topLevelPids",
};

/**
 * Update the shared states of react components.
 */
const editorReducer = (state: EditorState, { type, payload }: { type: string, payload: unknown}) => {
    if (type === "ADD_TO_OBJECT_DETAILS_STORAGE") {
        const { key, details } = payload as { key: string; details: ObjectDetails };
        const objectDetailsStorage = {
            ...state.objectDetailsStorage,
        };
        objectDetailsStorage[key] = details;
        return {
            ...state,
            objectDetailsStorage
        };
    } else if (type === "REMOVE_FROM_OBJECT_DETAILS_STORAGE") {
        const { key } = payload as { key: string };
        const objectDetailsStorage = {
            ...state.objectDetailsStorage,
        };
        delete objectDetailsStorage[key];
        return {
            ...state,
            objectDetailsStorage
        };
    } else if (type === "ADD_TO_PARENT_DETAILS_STORAGE") {
        const { shallow, key, details } = payload as { shallow: boolean; key: string; details: TreeNode };
        const parentDetailsStorage = {
            ...state.parentDetailsStorage,
        };
        parentDetailsStorage[key] = {
            ...state.parentDetailsStorage[key],
            [shallow ? "shallow" : "full"]: details,
        };
        return {
            ...state,
            parentDetailsStorage
        };
    } else if (type === "REMOVE_FROM_PARENT_DETAILS_STORAGE") {
        const { key } = payload as { key: string };
        const parentDetailsStorage = {
            ...state.parentDetailsStorage,
        };
        delete parentDetailsStorage[key];
        return {
            ...state,
            parentDetailsStorage
        };
    } else if (type === "ADD_TO_CHILD_LIST_STORAGE") {
        const { key, children } = payload as { key: string; children: ChildrenResultPage };
        const childListStorage = {
            ...state.childListStorage,
        };
        childListStorage[key] = children;
        return {
            ...state,
            childListStorage
        };
    } else if (type === "ADD_TO_CHILD_COUNTS_STORAGE") {
        const { key, counts }  = payload as { key: string, counts: ChildCounts };
        const childCountsStorage = {
            ...state.childCountsStorage,
        };
        childCountsStorage[key] = counts;
        return {
            ...state,
            childCountsStorage
        };
    } else if (type === "CLEAR_PID_FROM_CHILD_LIST_STORAGE") {
        const { pid } = payload as { pid: string };
        const childListStorage: Record<string, ChildrenResultPage> = {};
        for (const key in state.childListStorage) {
            if (!key.startsWith(pid + "_")) {
                childListStorage[key] = state.childListStorage[key];
            }
        }
        return {
            ...state,
            childListStorage
        };
    } else if (type === "RESET_CHILD_LIST_STORAGE") {
        const childListStorage: Record<string, ChildrenResultPage> = {};
        return {
            ...state,
            childListStorage
        };
    } else if (type === "CLEAR_PID_FROM_CHILD_COUNTS_STORAGE") {
        const { pid } = payload as { pid: string };
        const childCountsStorage: Record<string, ChildCounts> = {};
        for (const key in state.childCountsStorage) {
            if (key !== pid) {
                childCountsStorage[key] = state.childCountsStorage[key];
            }
        }
        return {
            ...state,
            childCountsStorage
        };
    } else if(Object.keys(reducerMapping).includes(type)){
        return {
            ...state,
            [reducerMapping[type]]: payload
        };
    } else {
        console.error(`fetch action type: ${type} does not exist`);
        return state;
    }
};

export const EditorContextProvider = ({ children }) => {
    const [state, dispatch] = useReducer(editorReducer, editorContextParams);
    const value = { state, dispatch };
    return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
};

export const useEditorContext = () => {
    const {
        action: {
            fetchJSON, fetchText
        }
    }= useFetchContext();
    const {
        state: {
            currentAgents,
            currentPid,
            activeDatastream,
            datastreamModalState,
            parentsModalActivePid,
            stateModalActivePid,
            agentsCatalog,
            dublinCoreFieldCatalog,
            favoritePidsCatalog,
            trashPid,
            processMetadataDefaults,
            toolPresets,
            vufindUrl,
            licensesCatalog,
            modelsCatalog,
            objectDetailsStorage,
            parentDetailsStorage,
            childCountsStorage,
            childListStorage,
            topLevelPids,
        },
        dispatch,
    } = useContext(EditorContext);

    const currentDatastreams = objectDetailsStorage?.[currentPid]?.datastreams ?? [];
    const currentModels = objectDetailsStorage?.[currentPid]?.models ?? [];
    const modelsDatastreams = currentModels.reduce((acc: Array<string>, model: string) => {
        const name = model.split(":")?.[1];
        return [
            ...acc,
            ...(name && modelsCatalog.hasOwnProperty(name) ? Object.keys(modelsCatalog[name].datastreams) : [])
        ];
    }, []).map((stream: string) => {
        return {
            disabled: !currentDatastreams.includes(stream),
            stream
        };
    });

    const addToObjectDetailsStorage = (key: string, details: ObjectDetails) => {
        dispatch({
            type: "ADD_TO_OBJECT_DETAILS_STORAGE",
            payload: { key, details },
        });
    };

    const removeFromObjectDetailsStorage = (key: string) => {
        dispatch({
            type: "REMOVE_FROM_OBJECT_DETAILS_STORAGE",
            payload: { key },
        });
    };

    const addToParentDetailsStorage = (key: string, details: TreeNode, shallow = false) => {
        dispatch({
            type: "ADD_TO_PARENT_DETAILS_STORAGE",
            payload: { shallow, key, details },
        });
    };

    const removeFromParentDetailsStorage = (key: string) => {
        dispatch({
            type: "REMOVE_FROM_PARENT_DETAILS_STORAGE",
            payload: { key },
        });
    };

    const setCurrentAgents = (currentAgents) => {
        dispatch({
            type: "SET_CURRENT_AGENTS",
            payload: currentAgents
        });
    };

    const setAgentsCatalog = (agentsCatalog) => {
        dispatch({
            type: "SET_AGENTS_CATALOG",
            payload: agentsCatalog
        });
    };

    const setDublinCoreFieldCatalog = (dcCatalog: Record<string, Record<string, string>>) => {
        dispatch({
            type: "SET_DUBLIN_CORE_FIELD_CATALOG",
            payload: dcCatalog
        });
    };

    const setTopLevelPids = (pids: Array<string>) => {
        dispatch({
            type: "SET_TOP_LEVEL_PIDS",
            payload: pids
        });
    };

    const addToChildListStorage = (key: string, children: ChildrenResultPage) => {
        dispatch({
            type: "ADD_TO_CHILD_LIST_STORAGE",
            payload: { key, children },
        });
    };

    const addToChildCountsStorage = (key: string, counts: ChildCounts) => {
        dispatch({
            type: "ADD_TO_CHILD_COUNTS_STORAGE",
            payload: { key, counts },
        });
    };

    const getChildListStorageKey = (pid: string, page: number, pageSize: number): string => {
        return `${pid}_${page}_${pageSize}`;
    };

    const loadObjectDetailsIntoStorage = async (pid: string, errorCallback: ((pid: string) => void) | null = null) => {
        // Ignore null values:
        if (pid === null) {
            return;
        }
        const url = getObjectDetailsUrl(pid);
        try {
            addToObjectDetailsStorage(pid, await fetchJSON(url));
        } catch (e) {
            if (errorCallback) {
                errorCallback(pid);
            }
            console.error("Problem fetching details from " + url);
        }
    };

    const loadParentDetailsIntoStorage = async (pid: string, shallow = false, errorCallback: ((pid: string) => void) | null = null) => {
        // Ignore null values:
        if (pid === null) {
            return;
        }
        const url = getObjectParentsUrl(pid, shallow);
        try {
            addToParentDetailsStorage(pid, await fetchJSON(url), shallow);
        } catch (e) {
            if (errorCallback) {
                errorCallback(pid);
            }
            console.error("Problem fetching parent details from " + url);
        }
    };

    const clearPidFromChildListStorage = (pid: string) => {
        dispatch({
            type: "CLEAR_PID_FROM_CHILD_LIST_STORAGE",
            payload: { pid },
        });
    }

    const resetChildListStorage = () => {
        dispatch({
            type: "RESET_CHILD_LIST_STORAGE",
            payload: {},
        });
    }

    const clearPidFromChildCountsStorage = (pid: string) => {
        dispatch({
            type: "CLEAR_PID_FROM_CHILD_COUNTS_STORAGE",
            payload: { pid },
        });
    }

    const loadChildrenIntoStorage = async (pid: string, page: number, pageSize: number) => {
        const key = getChildListStorageKey(pid, page, pageSize);
        const url = getObjectChildrenUrl(pid, (page - 1) * pageSize, pageSize);
        try {
            addToChildListStorage(key, await fetchJSON(url));
        } catch (e) {
            console.error("Problem fetching tree data from " + url);
        }
    };

    const loadChildCountsIntoStorage = async (pid: string) => {
        const url = getObjectChildCountsUrl(pid);
        try {
            addToChildCountsStorage(pid, await fetchJSON(url));
        } catch (e) {
            console.error("Problem fetching child count data from " + url);
        }
    };

    const setFavoritePidsCatalog = (favoritePidsCatalog: Record<string, string>) => {
        dispatch({
            type: "SET_FAVORITE_PIDS_CATALOG",
            payload: favoritePidsCatalog
        });
    }

    const setTrashPid = (trashPid: string) => {
        dispatch({
            type: "SET_TRASH_PID",
            payload: trashPid
        });
    }

    const setProcessMetadataDefaults = (defaults: Record<string, string>) => {
        dispatch({
            type: "SET_PROCESS_METADATA_DEFAULTS",
            payload: defaults
        });
    }

    const setToolPresets = (toolPresets: Array<Record<string, string>>) => {
        dispatch({
            type: "SET_TOOL_PRESETS",
            payload: toolPresets
        });
    }

    const setVuFindUrl = (url: string) => {
        dispatch({
            type: "SET_VUFIND_URL",
            payload: url
        });
    };

    const setModelsCatalog = (modelsCatalog: Record<string, FedoraModel>) => {
        dispatch({
            type: "SET_MODELS_CATALOG",
            payload: modelsCatalog
        });
    };

    const setLicensesCatalog = (licensesCatalog: Record<string, License>) => {
        dispatch({
            type: "SET_LICENSES_CATALOG",
            payload: licensesCatalog
        });
    };

    const setCurrentPid = (pid: string) => {
        dispatch({
            type: "SET_CURRENT_PID",
            payload: pid
        });
    };

    const setDatastreamModalState = (datastreamModalState: boolean) => {
        dispatch({
            type: "SET_DATASTREAM_MODAL_STATE",
            payload: datastreamModalState
        });
    };

    const setParentsModalActivePid = (pid: string) => {
        dispatch({
            type: "SET_PARENTS_MODAL_ACTIVE_PID",
            payload: pid
        });
    };

    const setStateModalActivePid = (pid: string) => {
        dispatch({
            type: "SET_STATE_MODAL_ACTIVE_PID",
            payload: pid
        });
    };

    const setActiveDatastream = (datastream: string) => {
        dispatch({
            type: "SET_ACTIVE_DATASTREAM",
            payload: datastream
        })
    };

    const datastreamsCatalog = Object.values(modelsCatalog).reduce((acc: Record<string, FedoraDatastream>, model) => {
        return {
            ...acc,
            ...(model as FedoraModel).datastreams
        };
    }, {});

    const initializeCatalog = async () => {
        try {
            const response = await fetchJSON(editObjectCatalogUrl);
            setModelsCatalog(response.models || {});
            setLicensesCatalog(response.licenses || {});
            setFavoritePidsCatalog(response.favoritePids || {});
            setTrashPid(response.trashPid || null);
            setToolPresets(response.toolPresets || []);
            setProcessMetadataDefaults(response.processMetadataDefaults || {});
            setAgentsCatalog(response.agents || {});
            setDublinCoreFieldCatalog(response.dublinCoreFields || {});
            setTopLevelPids(response.topLevelPids || []);
            setVuFindUrl(response.vufindUrl ?? "");
        } catch(err) {
            console.error(`Problem fetching object catalog from ${editObjectCatalogUrl}`);
        }
    };

    const loadCurrentObjectDetails = async (errorCallback: ((pid: string) => void) | null = null) => {
        return await loadObjectDetailsIntoStorage(currentPid, errorCallback);
    };

    const extractFirstMetadataValue = function (field: string, defaultValue: string): string {
        const currentMetadata = objectDetailsStorage?.[currentPid]?.metadata ?? {};
        return utilExtractFirstMetadataValue(currentMetadata, field, defaultValue);
    }

    const updateSingleObjectState = async (pid: string, newState: string, setStatusMessage: (msg: string) => void, remaining: number = 0): Promise<string> => {
        setStatusMessage(`Saving status for ${pid} (${remaining} more remaining)...`);
        const target = getObjectStateUrl(pid);
        const result = await fetchText(target, { method: "PUT", body: newState });
        if (result === "ok") {
            // Clear and reload the cached object, since it has now changed!
            removeFromObjectDetailsStorage(pid);
        }
        return result;
    };

    const saveObjectStateForChildPage = async (response, newState: string, found: number, total: number, setStatusMessage: (msg: string) => void): Promise<boolean> => {
        for (let i = 0; i < response.docs.length; i++) {
            const result = await updateSingleObjectState(response.docs[i].id, newState, setStatusMessage, total - (found + i));
            if (result !== "ok") {
                throw new Error(`Status failed to save; "${result}"`);
            }
        }
    };

    const applyObjectStateToChildren = async (pid: string, newState: string, expectedTotal: number, setStatusMessage: (msg: string) => void): Promise<boolean> => {
        const childPageSize = 1000;
        let found = 0;
        while (found < expectedTotal) {
            const url = getObjectRecursiveChildPidsUrl(pid, found, childPageSize);
            const nextResponse = await fetchJSON(url);
            await saveObjectStateForChildPage(nextResponse, newState, found, expectedTotal, setStatusMessage);
            found += nextResponse.docs.length;
        }
        return true;
    };

    /**
     * Update an object's state (and, optionally, the states of its children).
     * @param pid                The PID to update
     * @param newState           The new state to set
     * @param expectedChildCount The number of children to update (either the actual number of known children, or 0 to skip child updates)
     * @param setStatusMessage   Callback function to display status messages as we work
     * @returns An array for updating snackbar messages (first element = message, second element = level)
     */
    const updateObjectState = async function (pid: string, newState: string, expectedChildCount: number = 0, setStatusMessage: (msg: string) => void): Promise<Array<string>> {
        if (expectedChildCount > 0) {
            await applyObjectStateToChildren(pid, newState, expectedChildCount, setStatusMessage);
        }
        const result = await updateSingleObjectState(pid, newState, setStatusMessage);
        return (result === "ok")
            ? ["Status saved successfully.", "success"]
            : [`Status failed to save; "${result}"`, "error"];
    }

    /**
     * Attach a child object to the specified parent.
     * @param pid       Child PID
     * @param parentPid Parent PID
     * @param position  Position value (blank string for no position, number-as-string otherwise)
     * @returns A status string ("ok" on success, error message otherwise)
     */
    const attachObjectToParent = async function (pid: string, parentPid: string, position: string): Promise<string> {
        const target = getParentUrl(pid, parentPid);
        let result: string;
        try {
            result = await fetchText(target, { method: "PUT", body: position });
        } catch (e) {
            result = (e as Error).message ?? "Unexpected error";
        }
        if (result === "ok") {
            // Clear and reload the cached object and its parents, since these have now changed!
            removeFromObjectDetailsStorage(pid);
            removeFromParentDetailsStorage(pid);
            // Clear any cached lists belonging to the parent PID, because the
            // order has potentially changed!
            clearPidFromChildListStorage(parentPid);
        }
        return result;
    };

    /**
     * Detach a child object from the specified parent.
     * @param pid       Child PID
     * @param parentPid Parent PID
     * @returns A status string ("ok" on success, error message otherwise)
     */
    const detachObjectFromParent = async function (pid: string, parentPid: string): Promise<string> {
        const target = getParentUrl(pid, parentPid);
        let result: string;
        try {
            result = await fetchText(target, { method: "DELETE" });
        } catch (e) {
            result = (e as Error).message ?? "Unexpected error";
        }
        if (result === "ok") {
            // Clear and reload the cached object and its parents, since these have now changed!
            removeFromObjectDetailsStorage(pid);
            removeFromParentDetailsStorage(pid);
            // Clear any cached lists belonging to the parent PID, because the
            // order has potentially changed!
            clearPidFromChildListStorage(parentPid);
        }
        return result;
    };

    /**
     * Move a child object to the specified parent.
     * @param pid       Child PID
     * @param parentPid Parent PID
     * @param position  Position value (blank string for no position, number-as-string otherwise)
     * @returns A status string ("ok" on success, error message otherwise)
     */
    const moveObjectToParent = async function (pid: string, parentPid: string, position: string): Promise<string> {
        const target = getMoveToParentUrl(pid, parentPid);
        let result: string;
        try {
            result = await fetchText(target, { method: "POST", body: position });
        } catch (e) {
            result = (e as Error).message ?? "Unexpected error";
        }
        if (result === "ok") {
            // Clear and reload the cached object and its parents, since these have now changed!
            removeFromObjectDetailsStorage(pid);
            removeFromParentDetailsStorage(pid);
            // Clear all cached child lists, since multiple relationships may have been impacted.
            resetChildListStorage();
        }
        return result;
    };

    /**
     * Return the number of parents for the specified PID.
     * @param pid PID
     * @returns Number of parents in storage (null if unknown)
     */
    const getParentCountForPid = function (pid: string): number | null {
        const dataForPid = Object.prototype.hasOwnProperty.call(parentDetailsStorage, pid as string)
            ? parentDetailsStorage[pid]
            : {};
        return (dataForPid["shallow"]?.parents ?? dataForPid["full"]?.parents)?.length ?? null;
    };

    return {
        state: {
            currentAgents,
            currentPid,
            currentDatastreams,
            activeDatastream,
            datastreamModalState,
            parentsModalActivePid,
            stateModalActivePid,
            datastreamsCatalog,
            modelsDatastreams,
            agentsCatalog,
            dublinCoreFieldCatalog,
            favoritePidsCatalog,
            trashPid,
            processMetadataDefaults,
            toolPresets,
            vufindUrl,
            modelsCatalog,
            licensesCatalog,
            objectDetailsStorage,
            parentDetailsStorage,
            childCountsStorage,
            childListStorage,
            topLevelPids,
        },
        action: {
            initializeCatalog,
            setCurrentAgents,
            setCurrentPid,
            loadCurrentObjectDetails,
            setActiveDatastream,
            setDatastreamModalState,
            setParentsModalActivePid,
            setStateModalActivePid,
            extractFirstMetadataValue,
            getChildListStorageKey,
            loadObjectDetailsIntoStorage,
            loadParentDetailsIntoStorage,
            loadChildCountsIntoStorage,
            loadChildrenIntoStorage,
            removeFromObjectDetailsStorage,
            removeFromParentDetailsStorage,
            clearPidFromChildCountsStorage,
            clearPidFromChildListStorage,
            attachObjectToParent,
            detachObjectFromParent,
            moveObjectToParent,
            updateObjectState,
            getParentCountForPid,
        },
    };
}

export default {
    EditorContextProvider,
    DatastreamModalStates,
    useEditorContext
}
