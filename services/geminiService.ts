
import * as webllm from "@mlc-ai/web-llm";

// Interface used by the app to structure prompts (Text + Images)
interface Part {
    text?: string;
    inlineData?: {
        mimeType: string;
        data: string;
    };
}

// --- WebLLM Configuration ---
// Using Llama 3.2 1B Instruct - optimized for mobile (iPhone 13) and speed
const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f16_1";

let engine: webllm.MLCEngineInterface | null = null;
let isModelLoading = false;

// Callback function to report download progress to the UI
let onProgressCallback: ((progress: string) => void) | null = null;

/**
 * Registers a callback to receive model loading progress updates.
 * Used by components to show a progress bar or status message.
 */
export const setModelProgressCallback = (cb: (progress: string) => void) => {
    onProgressCallback = cb;
};

/**
 * Initializes the WebLLM engine.
 * This triggers the model download on the first run.
 * Implements a Singleton pattern to avoid re-initializing.
 */
export const initModel = async () => {
    if (engine) {
        return engine;
    }

    if (isModelLoading) {
        // If already loading, return a promise that resolves when loaded
        return new Promise<webllm.MLCEngineInterface>((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (engine) {
                    clearInterval(checkInterval);
                    resolve(engine);
                } else if (!isModelLoading) {
                    // Loading finished but engine is null (error occurred)
                    clearInterval(checkInterval);
                    reject(new Error("Falha na inicialização do modelo."));
                }
            }, 500);
        });
    }

    isModelLoading = true;

    try {
        // Custom handler to update UI with friendly messages
        const initProgressCallback = (report: webllm.InitProgressReport) => {
            console.log("WebLLM Progress:", report.text);
            if (onProgressCallback) {
                onProgressCallback(report.text);
            }
        };

        // Create the engine with WebGPU support
        // Llama-3.2-1B is roughly 1GB download, cached in IndexedDB
        engine = await webllm.CreateMLCEngine(
            SELECTED_MODEL,
            { 
                initProgressCallback: initProgressCallback,
                logLevel: "INFO" 
            }
        );

        return engine;
    } catch (error) {
        console.error("WebLLM Init Error:", error);
        isModelLoading = false;
        throw new Error("Seu dispositivo não suporta WebGPU ou houve erro no download do modelo. Certifique-se de usar um navegador compatível (Chrome, Edge, Safari no iOS 15+).");
    } finally {
        isModelLoading = false;
    }
};

/**
 * Service to interact with Local WebLLM.
 * Completely offline and private execution.
 */
export const callGenerativeAI = async (prompt: string | Part[]): Promise<string> => {
    let messageContent = '';

    // 1. Adapter: Convert complex prompt structure to simple string
    if (typeof prompt === 'string') {
        messageContent = prompt;
    } else if (Array.isArray(prompt)) {
        // Extract text parts.
        // Note: Current WebLLM implementation here focuses on Text-only models (Llama 3.2).
        // Multimodal support would require a different model (e.g., Llama 3.2 Vision), keeping it simple for iPhone 13 performance.
        messageContent = prompt
            .map(p => p.text || '')
            .join('\n');

        const hasImages = prompt.some(p => p.inlineData);
        if (hasImages) {
            console.warn("WebLLM: Imagens foram ignoradas. O modelo Llama 3.2 1B Lite processa apenas texto para máxima velocidade.");
        }
    }

    const systemInstruction = "Você é um assistente especializado em educação, focado na criação de Planos Educacionais Individualizados (PEI). Suas respostas devem ser profissionais, bem estruturadas e direcionadas para auxiliar educadores. Sempre que apropriado, considere e sugira estratégias baseadas nos princípios do Desenho Universal para a Aprendizagem (DUA).";

    try {
        // Ensure engine is loaded
        if (!engine) {
            if (onProgressCallback) onProgressCallback("Iniciando motor de IA local...");
            await initModel();
        }

        // Generate response
        const response = await engine!.chat.completions.create({
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: messageContent }
            ],
            // Lower temperature for more deterministic/professional results
            temperature: 0.7,
            max_tokens: 2048, // Allow sufficient length for full PEIs
        });

        return response.choices[0].message.content || "";

    } catch (error) {
        console.error("WebLLM Generation Error:", error);
        const msg = String(error);
        
        if (msg.includes("WebGPU")) {
            throw new Error("Erro de WebGPU. Verifique se seu navegador suporta aceleração de hardware.");
        }
        
        throw new Error(`Erro na IA Local: ${msg}`);
    }
};
