/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/



import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";
import { Frame } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const imageModel = 'gemini-2.5-flash-image';

export interface AnimationAssets {
  imageData: { data: string, mimeType: string };
  frames: Frame[];
  frameDuration: number;
}

const base64ToGenerativePart = (base64: string, mimeType: string) => {
    return {
      inlineData: {
        data: base64,
        mimeType,
      },
    };
};

export const generateAnimationAssets = async (
    base64UserImage: string | null,
    mimeType: string | null,
    imagePrompt: string,
    onProgress: (message: string) => void
): Promise<AnimationAssets | null> => {
  try {
    const imageGenTextPart = { text: imagePrompt };
    const parts = [];

    if (base64UserImage && mimeType) {
        const userImagePart = base64ToGenerativePart(base64UserImage, mimeType);
        parts.push(userImagePart);
    }
    parts.push(imageGenTextPart);
    
    const imageGenResponse: GenerateContentResponse = await ai.models.generateContent({
        model: imageModel,
        contents: [{
            role: "user",
            parts: parts,
        }],
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });

    const responseParts = imageGenResponse.candidates?.[0]?.content?.parts;
    if (!responseParts) {
        throw new Error("Invalid response from model. No parts found.");
    }

    const imagePart = responseParts.find(p => p.inlineData);
    if (!imagePart?.inlineData?.data) {
        console.error("No image part found in response from image generation model", imageGenResponse);
        const text = responseParts.find(p => p.text)?.text;
        throw new Error(`Model did not return an image. Response: ${text ?? "<no text>"}`);
    }
    const imageData = { data: imagePart.inlineData.data, mimeType: imagePart.inlineData.mimeType };
    
    // Extract and parse frame duration from the text part
    let frameDuration = 120; // Default fallback value
    const textPart = responseParts.find(p => p.text);
    if (textPart?.text) {
        try {
            const jsonStringMatch = textPart.text.match(/{.*}/s);
            if (jsonStringMatch) {
                const parsed = JSON.parse(jsonStringMatch[0]);
                if (parsed.frameDuration && typeof parsed.frameDuration === 'number') {
                    frameDuration = parsed.frameDuration;
                }
            }
        } catch (e) {
            console.warn("Could not parse frame duration from model response. Using default.", e);
        }
    }

    return { imageData, frames: [], frameDuration };
  } catch (error) {
    console.error("Error during asset generation:", error);
    throw new Error(`Failed to process image. ${error instanceof Error ? error.message : ''}`);
  }
};


export const addTextToSpriteSheet = async (
    base64SpriteSheet: string,
    mimeType: string,
    topText: string,
    bottomText: string,
    font: string,
): Promise<{ data: string, mimeType: string }> => {
    const prompt = `
You are an expert image editor specializing in creating memes.
Your task is to add text to a 9-frame sprite sheet, which is arranged in a 3x3 grid.

INSTRUCTIONS:
1.  Add the following text to the TOP of EACH of the 9 frames: "${topText}"
2.  Add the following text to the BOTTOM of EACH of the 9 frames: "${bottomText}"
3.  The text MUST be in the '${font}' font. If that font is not available, use a similar bold, condensed sans-serif font like Impact or Arial Black.
4.  The text MUST be white with a thin black stroke/outline to ensure readability on any background.
5.  The text position, size, and style MUST be identical across all 9 frames to ensure a consistent animation.
6.  Do not change anything else in the image. Preserve the original content of the frames.

IMAGE OUTPUT REQUIREMENTS:
- The output MUST be a single image file with the same dimensions as the input.
- DO NOT return any text or JSON. Only the modified sprite sheet image is required.`;

    const imagePart = base64ToGenerativePart(base64SpriteSheet, mimeType);
    const textPart = { text: prompt };
    
    try {
        const response = await ai.models.generateContent({
            model: imageModel,
            contents: [{ role: "user", parts: [imagePart, textPart] }],
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });
        
        const responseParts = response.candidates?.[0]?.content?.parts;
        const newImagePart = responseParts?.find(p => p.inlineData);

        if (!newImagePart?.inlineData?.data) {
            const textResponse = responseParts?.find(p => p.text)?.text;
            console.error("Model did not return an image after adding text. Response:", textResponse);
            throw new Error(`The AI failed to modify the image. Please try different text or regenerate the animation.`);
        }

        return { data: newImagePart.inlineData.data, mimeType: newImagePart.inlineData.mimeType };
    } catch (error) {
        console.error("Error applying text via Gemini API:", error);
        if (error instanceof Error && error.message.startsWith('The AI failed')) {
            throw error;
        }
        throw new Error('An API error occurred while applying text. Please try again.');
    }
};