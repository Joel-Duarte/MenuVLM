import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as fsp from 'fs/promises';
import dotenv from 'dotenv';
import sharp from 'sharp'; 

dotenv.config();

const OLLAMA_API_URL = process.env.OLLAMA_API_URL;
const OLLAMA_MODEL = process.env.OLLAMA_MODEL;
const OLLAMA_MENU_PROMPT = process.env.OLLAMA_MENU_PROMPT;


const app = express();
const port = 3000;

const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'image/avif'];
const uploadDir = path.join('uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    console.log(`Created uploads directory at: ${uploadDir}`);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },    
    filename: (req, file, cb) => {
        const fileExtension = path.extname(file.originalname);
        cb(null, "menu" + fileExtension);
    }
});

const upload = multer({ storage: storage });

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use(cors());
app.use(express.json());

app.get('/api/test-connection', (req, res) => {
    console.log('Received GET request on /api/test-connection');
    res.json({ status: 'connected', message: 'Successfully connected to the server!' });
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
    console.log('Reveived POST request on /api/upload');

    if (!req.file) {
        console.log('No file uploaded.');
        res.status(400).send('No file uploaded.');
        return;
    }

    if (!allowedMimeTypes.includes(req.file.mimetype)) {
        console.log('Invalid file type uploaded:', req.file?.mimetype);
        res.status(400).json({ message: 'Invalid file type. Only image files (JPEG, PNG, WEBP, AVIF) are allowed.' });
        return; 
    }

    // --- Image Pre-processing (Deblur, Upscale, Normalize, Grayscale, Noise Reduction) using Sharp ---
    let processedImageBuffer: Buffer;
    let processedMimeType: string = 'image/png'; 

    console.log(`Processing image locally: ${req.file.filename} (deblurring, upscaling, normalizing, grayscale, noise reduction)`);

    try {

        const imageInfo = await sharp(req.file.path).metadata();
        if (!imageInfo.width || !imageInfo.height) {
            throw new Error("Could not get image dimensions for processing.");
        }

        // Minimum resolution check
        const minResolution = 300;
        if (imageInfo.width < minResolution || imageInfo.height < minResolution) {
            try {
                await fsp.unlink(req.file.path);
                console.log(`Deleted file due to low resolution: ${req.file.filename}`);
            } catch (unlinkError) {
                console.error('Error deleting low-resolution file:', unlinkError);
            }
            res.status(400).json({
                message: `Image resolution is too low (${imageInfo.width}x${imageInfo.height}). Minimum required is ${minResolution}x${minResolution}.`,
                error: "true"
            });
            return;
        }

        if (!imageInfo.width || !imageInfo.height) {
            throw new Error("Could not get image dimensions for processing.");
        }
        

        processedImageBuffer = await sharp(req.file.path)
            .sharpen() // Apply a sharpening filter to reduce blur
            .normalize() // Enhance contrast
            .grayscale() // Convert to grayscale (usually bettter for OCR)
            .median(3) // Apply a median filter for noise reduction
            .png({ quality: 90 }) // Convert to PNG for lossless quality
            .toBuffer();

        console.log(`Image processed: Deblurred, normalized, converted to grayscale, and noise reduced.`);

    } catch (processingError) {
        console.error('Error during local image pre-processing:', processingError);
        // Delete file if processing failed
        try {
            await fsp.unlink(req.file.path);
            console.log(`Deleted original file due to processing error: ${req.file.filename}`);
        } catch (unlinkError) {
            console.error('Error deleting original file after processing failure:', unlinkError);
        }
        res.status(500).json({ message: 'Image pre-processing failed.', error: processingError.message });
        return;
    }

    // Ollama Processing

    console.log(`Sending image to Ollama for menu extraction: ${req.file.filename}`);
    try {
        // old img load to buffer
        //const imageBuffer = await fsp.readFile(req.file.path);
        const base64ImageData = processedImageBuffer.toString('base64');

        // Ollama generation parameters
        const ollamaGenerationOptions = {
            temperature: 0.2,   
            top_k: 40,          
            top_p: 0.9,         
            num_predict: 1024, 
            seed: 42  
        };
        // Construct the payload for the Ollama API
        const ollamaPayload = {
            model: OLLAMA_MODEL,
            prompt: OLLAMA_MENU_PROMPT, // Use the prompt from .env
            stream: false, // We want a single response, not a stream
            images: [base64ImageData], // Send the image data
            options: ollamaGenerationOptions
        };

        const ollamaResponse = await fetch(`${OLLAMA_API_URL}/api/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(ollamaPayload),
        });

        if (!ollamaResponse.ok) {
            const errorText = await ollamaResponse.text();
            throw new Error(`Ollama API error: ${ollamaResponse.status} ${ollamaResponse.statusText} - ${errorText}`);
        }

        const ollamaResult = await ollamaResponse.json();
        const responseText = ollamaResult.response;

        // --- Start of JSON parsing refinement ---
        let extractedJsonString = '';

        // 1. Try to extract from a markdown code block (```json ... ```)
        const jsonCodeBlockMatch = responseText.match(/```json\s*([\s\S]*?)```/);
        if (jsonCodeBlockMatch && jsonCodeBlockMatch[1]) {
            extractedJsonString = jsonCodeBlockMatch[1].trim();
            console.log("Extracted JSON from markdown block.");
        } else {
            // 2. If no markdown block, try to find the first '{' or '[' and the last '}' or ']'
            const firstBraceIndex = responseText.indexOf('{');
            const firstBracketIndex = responseText.indexOf('[');

            let jsonStartIndex = -1;
            let jsonEndIndex = -1;

            // Determine if the JSON starts with an object or an array and find its extent
            if (firstBraceIndex !== -1 && (firstBracketIndex === -1 || firstBraceIndex < firstBracketIndex)) {
                // Starts with an object
                jsonStartIndex = firstBraceIndex;
                jsonEndIndex = responseText.lastIndexOf('}');
            } else if (firstBracketIndex !== -1) {
                // Starts with an array
                jsonStartIndex = firstBracketIndex;
                jsonEndIndex = responseText.lastIndexOf(']');
            }

            if (jsonStartIndex !== -1 && jsonEndIndex !== -1 && jsonEndIndex > jsonStartIndex) {
                extractedJsonString = responseText.substring(jsonStartIndex, jsonEndIndex + 1);
                console.log("Extracted JSON from direct brace/bracket matching.");
            } else {
                // Fallback: If no clear JSON structure is found, assume the whole response might be JSON
                extractedJsonString = responseText.trim();
                console.log("No clear JSON structure found, attempting to parse entire response.");
            }
        }

        // Attempt to parse the response text as JSON
        let extractedMenu: any;
        try {
            extractedMenu = JSON.parse(extractedJsonString);
        } catch (jsonParseError) {
            console.error('Failed to parse Ollama response as JSON:', responseText, jsonParseError);
            // If Ollama didn't return valid JSON, treat it as an error or unexpected output
            res.status(500).json({ message: 'Ollama returned non-JSON or unexpected format.', rawResponse: responseText });
            return;
        }

        // Check for the error flag from the prompt's instruction
        if (extractedMenu && extractedMenu.error === "true") {
            console.log('Ollama indicated an error:', extractedMenu.message);
            res.status(400).json({ message: extractedMenu.message });
            return;
        }

        console.log('Successfully extracted menu information.');
        res.json({
            message: 'Menu information extracted successfully!',
            menu: extractedMenu,
            timestamp: new Date().toISOString()
        });

    } catch (ollamaError) {
        console.error('Error during Ollama API call:', ollamaError);
        res.status(500).json({ message: 'Failed to extract menu information using Ollama.', error: ollamaError.message });
    } finally {
        try {
            await fsp.unlink(req.file.path);
            console.log(`Deleted temporary uploaded file: ${req.file.filename}`);
        } catch (unlinkError) {
            console.error('Error deleting temporary file:', unlinkError);
        }
    }
});

app.listen(port, () => {
    console.log(`Server started on http://localhost:${port}`);
});
