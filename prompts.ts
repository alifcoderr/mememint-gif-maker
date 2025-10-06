/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const promptSuggestions = [
  { emoji: '🤖', prompt: 'Make a cool micro sci-fi story spanning a Millenia about a robot and its maker.' },
  { emoji: '💡', prompt: 'I just had a great idea! in style of a hand-drawn pencil sketch.' },
  { emoji: '🛑', prompt: 'Tell a little story using the objects in the image, in style of stop-motion animation.' },
  { emoji: '💫', prompt: 'Spin the scene 360 degrees in 3D.' },
  { emoji: '🌸', prompt: 'Flower up the scene.' },
  { emoji: '🏃', prompt: 'Tell them I\'m "On my way!", 80s video game style' },
];

export const buildCreativeInstruction = (
  storyPrompt: string, 
  originalImage: string | null, 
  frameCount: number
): string => {
  const baseInstruction = `Create a short, ${frameCount}-frame animation. The movement should be smooth and believable, and the final frame should loop back smoothly to the first.`;
  const styleConsistencyInstruction = `It is crucial that all ${frameCount} frames are in the same, consistent artistic style.`;
  const identityLockInstruction = `Maintain the subject's core facial features and identity consistently across all frames. The person or subject should be clearly recognizable from one frame to the next. Avoid distorting the face or adding new features.`;
  
  const frameDurationInstruction = `
Based on the creative direction, determine the optimal frame duration for the animation.
- For slow, story-like animations, choose a longer duration (e.g., 400-2000ms per frame).
- For fast, dynamic animations, choose a shorter duration (e.g., 80-120ms per frame).
`;

  let creativeDirection = '';
  if (originalImage) {
    creativeDirection = `
CREATIVE DIRECTION (based on user image and prompt):
Animate the subject from the provided image based on the following description: "${storyPrompt}".
${baseInstruction}
${styleConsistencyInstruction}
${identityLockInstruction}`;
  } else if (storyPrompt) {
    creativeDirection = `
CREATIVE DIRECTION (based on user prompt):
Create an animation from scratch based on the following description: "${storyPrompt}".
${baseInstruction}`;
  } else {
      return '';
  }

  return `
${creativeDirection}
${frameDurationInstruction}

REQUIRED RESPONSE FORMAT:
Your response MUST contain two parts:
1. A valid JSON object containing a single key: "frameDuration". The value must be a number representing the milliseconds per frame (between 80 and 2000, per instructions above). Do not wrap the JSON in markdown backticks.
2. The ${frameCount}-frame sprite sheet image.

Example of the JSON part:
{"frameDuration": 150}
`;
};
