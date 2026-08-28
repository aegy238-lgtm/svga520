import { Zip, ZipPassThrough } from 'fflate';

export async function createStreamingZip(filename: string): Promise<{
    addFile: (name: string, data: Uint8Array) => void;
    close: () => Promise<void>;
    abort: () => Promise<void>;
}> {
    let writable: any = null;
    let fallbackChunks: Uint8Array[] = [];
    let zip = new Zip();
    let opfsHandle: FileSystemFileHandle | null = null;
    let isOpfs = false;
    
    // Try File System Access API first (Chrome/Edge desktop)
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await (window as any).showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: 'ZIP Archive', accept: { 'application/zip': ['.zip'] } }],
            });
            writable = await handle.createWritable();
        } catch (e: any) {
            if (e.name === 'AbortError') {
                throw new Error("USER_ABORT"); // Stop export if user cancels
            }
            console.warn("showSaveFilePicker blocked, falling back to OPFS or Blob", e);
        }
    }

    // Fallback to OPFS to save RAM
    if (!writable && navigator.storage && navigator.storage.getDirectory) {
        try {
            const root = await navigator.storage.getDirectory();
            // remove old file if exists
            try { await root.removeEntry(filename); } catch(e) {}
            opfsHandle = await root.getFileHandle(filename, { create: true });
            writable = await opfsHandle.createWritable();
            isOpfs = true;
        } catch (e) {
            console.warn("OPFS failed, falling back to RAM Blob memory", e);
        }
    }

    let onDataPromise: Promise<void> = Promise.resolve();

    zip.ondata = (err, dat, final) => {
        if (err) throw err;
        
        onDataPromise = onDataPromise.then(async () => {
            if (writable) {
                await writable.write(dat);
            } else {
                fallbackChunks.push(new Uint8Array(dat)); // CLONE the array because fflate reuses the buffer
            }
        });
    };

    return {
        addFile: (name: string, data: Uint8Array) => {
            const file = new ZipPassThrough(name);
            zip.add(file);
            file.push(data, true); // true indicates end of this file
        },
        close: async () => {
            zip.end();
            await onDataPromise; // wait for all data to be flushed
            
            if (writable) {
                await writable.close();
            }
            
            if (isOpfs && opfsHandle) {
                // OPFS download
                const file = await opfsHandle.getFile();
                const url = URL.createObjectURL(file);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(async () => {
                    URL.revokeObjectURL(url);
                    // cleanup OPFS
                    try {
                        const root = await navigator.storage.getDirectory();
                        await root.removeEntry(filename);
                    } catch(e) {}
                }, 5000);
            } else if (!isOpfs && !writable) {
                // Blob memory download
                const blob = new Blob(fallbackChunks, { type: 'application/zip' });
                fallbackChunks = []; // free memory
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
        },
        abort: async () => {
            if (writable) {
                try { await writable.abort(); } catch(e) {}
            }
            fallbackChunks = [];
            if (isOpfs) {
                try {
                    const root = await navigator.storage.getDirectory();
                    await root.removeEntry(filename);
                } catch(e) {}
            }
        }
    };
}
