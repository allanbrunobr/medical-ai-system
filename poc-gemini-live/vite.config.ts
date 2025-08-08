import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GOOGLE_GENERATIVE_AI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GOOGLE_GENERATIVE_AI_API_KEY),
        'process.env.GEMINI_MODEL_MEDICAL': JSON.stringify(env.GEMINI_MODEL_MEDICAL),
        'process.env.PUBMED_API_KEY': JSON.stringify(env.PUBMED_API_KEY),
        'process.env.PUBMED_TOOL_NAME': JSON.stringify(env.PUBMED_TOOL_NAME),
        'process.env.PUBMED_EMAIL': JSON.stringify(env.PUBMED_EMAIL)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
