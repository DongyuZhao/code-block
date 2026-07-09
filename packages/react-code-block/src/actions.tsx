import type { ReactNode } from "react";

export type Action = {
    id: string;
    label: string;
    icon?: ReactNode;
    run: () => void | Promise<void>;
};

export type Actions = {
    show?: boolean;
    extensions?: readonly Action[];
};

type SharePort = {
    share?: (data: ShareData) => Promise<void>;
};

function browserSharePort(): SharePort {
    return typeof navigator === "undefined" ? {} : navigator;
}

export function canShare(port: SharePort = browserSharePort()): boolean {
    return typeof port.share === "function";
}

export async function share(code: string, port: SharePort = browserSharePort()): Promise<void> {
    if (typeof port.share !== "function") {
        return;
    }

    try {
        await port.share({ text: code });
    } catch (error) {
        if (!isAbortError(error)) {
            throw error;
        }
    }
}

function isAbortError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "name" in error &&
        error.name === "AbortError"
    );
}
