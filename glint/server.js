import express from 'express';
import path from 'node:path';
import { app, root, mediaDir } from './app.js';
import { aiConfig } from './lib/ai.js';
import { useBlob } from './lib/storage.js';

const PORT = Number(process.env.PORT) || 4747;

const server = express();
server.use('/media', express.static(mediaDir, { maxAge: '1h' }));
server.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));
server.get('/v/:id', (req, res) => res.sendFile(path.join(root, 'public', 'watch.html')));
server.use(app);

server.listen(PORT, () => {
	const c = aiConfig();
	console.log(`\n  ● Glint running at http://localhost:${PORT}`);
	console.log(`    AI: ${c.enabled ? `Groq (${c.model})` : 'off — set GROQ_API_KEY in .env'}`);
	console.log(`    Transcription: ${c.transcription ? 'Groq Whisper' : 'browser live captions'}`);
	console.log(`    Storage: ${useBlob() ? 'Vercel Blob' : 'local disk (./data)'}`);
	console.log(`    Password: ${process.env.APP_PASSWORD ? 'on' : 'off (set APP_PASSWORD to lock it)'}\n`);
});
