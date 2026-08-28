import { extractVapConfigFromBlob } from './vapEngine';

export const parseVapMetadata = async (file: File): Promise<any> => {
    const config = await extractVapConfigFromBlob(file);
    if (config) {
        return config;
    }
    // Default fallback if metadata box is absent
    return {
        info: {
            v: 2,
            f: 30,
            w: 750,
            h: 750,
            rgbFrame: [0, 0, 750, 750],
            aFrame: [750, 0, 750, 750]
        }
    };
};
