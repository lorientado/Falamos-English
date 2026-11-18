import 'dotenv/config';
import http from 'node:http';
import path from 'node:path';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';

const PORT = 3000;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseJsonSafely<T>(rawText: string | undefined, fallback: T): T {
  const trimmed = (rawText ?? '').trim();
  if (!trimmed) return fallback;
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned) as T;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`TIMEOUT:${label} exceeded ${ms}ms`));
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return (
    msg.includes('TIMEOUT:') ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand') ||
    msg.includes('500') ||
    msg.includes('INTERNAL') ||
    msg.includes('ECONNRESET') ||
    msg.includes('ETIMEDOUT')
  );
}

async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts = 3,
  timeoutMs = 12000
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await withTimeout(fn(attempt), timeoutMs, `attempt-${attempt}`);
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts && isTransientError(err)) {
        const delayMs = attempt === 1 ? 400 : 900;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

function formatGeminiErrorGl(err: unknown, fallbackMsg: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  let code: number | undefined;
  let apiStatus = '';
  let apiMessage = raw;

  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; status?: string; message?: string } };
    if (parsed?.error) {
      code = parsed.error.code;
      apiStatus = parsed.error.status ?? '';
      apiMessage = parsed.error.message ?? raw;
    }
  } catch {
    // plain text error
  }

  if (code === 403 || apiStatus === 'PERMISSION_DENIED' || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      message: 'A clave de Gemini API non é válida ou non ten permisos. Revisa Settings > Secrets.',
    };
  }
  if (code === 429 || apiStatus === 'RESOURCE_EXHAUSTED') {
    return {
      status: 429,
      message: 'Acadouse o límite temporal de consultas á IA. Agarda uns segundos e téntao de novo.',
    };
  }
  if (code === 503 || apiStatus === 'UNAVAILABLE' || raw.includes('high demand') || raw.includes('TIMEOUT:')) {
    return {
      status: 503,
      message: 'O titor de IA está moi ocupado neste intre. Agarda uns segundos e téntao outra vez.',
    };
  }
  if (code === 404 || apiStatus === 'NOT_FOUND') {
    return {
      status: 404,
      message: 'O servizo do modelo de IA non está dispoñible neste momento.',
    };
  }
  return { status: 502, message: apiMessage || fallbackMsg };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '4mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasGeminiKey: Boolean(getAiClient()) });
  });

  app.post('/api/chat', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Non hai unha clave GEMINI_API_KEY configurada no servidor. Podes usar o modo de diálogo guiado ou configurala en Settings > Secrets.',
      });
      return;
    }

    try {
      const {
        scenarioTitleEn,
        scenarioRole,
        cefrLevel,
        ageTrack,
        grade,
        missions,
        vocabularyList,
        history,
        userMessage,
      } = req.body ?? {};

      if (!userMessage || typeof userMessage !== 'string') {
        res.status(400).json({ error: 'Falta a mensaxe do alumno.' });
        return;
      }

      const cleanGrade = typeof grade === 'string' ? grade.trim() : '';
      const isStarter =
        ageTrack === '7-9' ||
        cleanGrade === '2º Primaria' ||
        cleanGrade === '3º Primaria' ||
        cleanGrade === '4º Primaria';
      const isUpperEso = cleanGrade === '1º ESO' || cleanGrade === '2º ESO';

      const ageGuide = isStarter
        ? [
            `Student profile: ${cleanGrade || '7–9 years old'} (A1 Starter).`,
            'STRICT LEXICAL CARE: Use ONLY ultra-simple, concrete A1 words and words from the allowed vocabulary list below. NEVER use phrasal verbs, idioms, slang, passive voice, or B1+ words.',
            'SENTENCE LENGTH: Write 1–2 very short, warm sentences (max 7 words per sentence). Ask only ONE easy question at a time and suggest 2 easy options when helpful.',
          ].join('\n')
        : isUpperEso
          ? [
              `Student profile: ${cleanGrade} (12–14 years old, CEFR A1–A2).`,
              'LEXICAL CARE: Use natural everyday A1–A2 words anchored in the allowed vocabulary list. Avoid B2/C1 words or obscure idioms.',
              'SENTENCE LENGTH: Write 1–3 clear sentences (8–15 words per sentence) with everyday polite forms and one engaging follow-up question.',
            ].join('\n')
          : [
              `Student profile: ${cleanGrade || '5º Primaria'} (10–12 years old, CEFR A1 moving into basic A2).`,
              'LEXICAL CARE: Prioritize core A1 words and the allowed vocabulary list below. Avoid phrasal verbs, idioms, or B1+ vocabulary.',
              'SENTENCE LENGTH: Write 1–2 clear, unhurried sentences (6–11 words per sentence) using simple structures and one friendly follow-up question.',
            ].join('\n');

      const systemInstruction = [
        `You are playing the role of "${scenarioRole}" in the English communicative scenario "${scenarioTitleEn}" (${cefrLevel}).`,
        ageGuide,
        `Allowed key vocabulary to weave in naturally: ${(vocabularyList || []).slice(0, 14).join(', ')}.`,
        `Communicative goals for the student: ${(missions || []).join('; ')}.`,
        'Respond in English for replyEn. Put any gentle correction or helpful tip in Galician (galego) in hintGl/correctionGl so the Galician learner understands clearly.',
        'Keep the conversation playful, patient, supportive, and focused on basic communicative competence.',
      ].join('\n');

      const transcriptText = Array.isArray(history)
        ? history
            .slice(-8)
            .map((m: { speaker: string; text: string }) => `${m.speaker === 'user' ? 'Student' : 'Tutor'}: ${m.text}`)
            .join('\n')
        : '';

      const prompt = transcriptText
        ? `${transcriptText}\nStudent: ${userMessage}\nRespond to the student's latest message.`
        : `Student: ${userMessage}\nRespond warmly and ask one simple follow-up question.`;

      const response = await withRetry((attempt) => {
        const useLite = attempt >= 2;
        return ai.models.generateContent({
          model: useLite ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            systemInstruction,
            ...(useLite ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                replyEn: {
                  type: Type.STRING,
                  description: 'Natural, level-appropriate reply in English.',
                },
                hintGl: {
                  type: Type.STRING,
                  description: 'Short helpful tip or suggested English phrase explained in Galician.',
                },
                correctionGl: {
                  type: Type.STRING,
                  description:
                    'Empty string if the student message was accurate, or a brief friendly correction in Galician showing the better English phrase.',
                },
                completedMissionIndex: {
                  type: Type.INTEGER,
                  description:
                    'Zero-based index (0, 1, or 2) of a communicative mission clearly achieved in this turn, or -1 if none.',
                },
              },
              required: ['replyEn', 'hintGl', 'correctionGl', 'completedMissionIndex'],
            },
          },
        });
      });

      const parsed = parseJsonSafely(response.text, {
        replyEn: 'Great job! Let us keep practising.',
        hintGl: '',
        correctionGl: '',
        completedMissionIndex: -1,
      });
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiErrorGl(err, 'Erro ao conectar con Gemini.');
      console.error('/api/chat error:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/feedback', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'Non hai unha clave GEMINI_API_KEY configurada para xerar tarxetas personalizadas coa IA.',
      });
      return;
    }

    try {
      const { transcript, ageTrack, grade, scenarioTitleGl } = req.body ?? {};
      if (!Array.isArray(transcript) || transcript.length === 0) {
        res.status(400).json({ error: 'Non hai conversa para analizar.' });
        return;
      }

      const dialogue = transcript
        .map((e: { speaker: string; text: string }) => `${e.speaker === 'user' ? 'Alumno/a' : 'Titor'}: ${e.text}`)
        .join('\n');

      const levelLabel =
        ageTrack === '7-9'
          ? `${grade || '2º-4º Primaria'} (7-9 anos, A1 inicial)`
          : `${grade || '5º EP-2º ESO'} (10-14 anos, A1-A2)`;

      const response = await withRetry((attempt) => {
        const useLite = attempt >= 2;
        return ai.models.generateContent({
          model: useLite ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen',
          contents: [
            `Analiza esta pequena conversa en inglés (${levelLabel}) na situación "${scenarioTitleGl || 'práctica'}":`,
            dialogue,
            'Crea entre 1 e 4 tarxetas de repaso (flashcards) cos erros reais ou expresións mellorables do alumnado, adaptando o léxico e a dificultade estritamente ao seu curso e nivel. Se non houbo erros, propón 2 expresións útiles do seu nivel para ampliar o seu inglés nesta situación. Toda a explicación debe estar en galego claro e próximo para nenos.',
          ].join('\n\n'),
          config: {
            ...(useLite ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summaryGl: {
                  type: Type.STRING,
                  description: 'Encouraging 1-2 sentence summary in Galician.',
                },
                feedback: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      incorrect: {
                        type: Type.STRING,
                        description: 'What the student said or a simple starter sentence in English.',
                      },
                      correct: {
                        type: Type.STRING,
                        description: 'The natural, correct English expression.',
                      },
                      explanation: {
                        type: Type.STRING,
                        description: 'Friendly, clear explanation in Galician.',
                      },
                    },
                    required: ['incorrect', 'correct', 'explanation'],
                  },
                },
              },
              required: ['summaryGl', 'feedback'],
            },
          },
        });
      });

      const parsed = parseJsonSafely(response.text, { summaryGl: '', feedback: [] });
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiErrorGl(err, 'Erro ao xerar a revisión.');
      console.error('/api/feedback error:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const ttsCache = new Map<string, string>();

  app.post('/api/tts', async (req, res) => {
    const ai = getAiClient();
    if (!ai) {
      res.status(503).json({
        error: 'GEMINI_API_KEY non dispoñible; usa a voz do navegador.',
      });
      return;
    }

    try {
      const { text, pace } = req.body ?? {};
      if (!text || typeof text !== 'string') {
        res.status(400).json({ error: 'Falta o texto para ler.' });
        return;
      }

      const resolvedPace =
        pace === 'slow' || pace === 'moderate' || pace === 'standard' ? pace : 'standard';
      const cacheText = text.trim();
      const cacheKey = `${resolvedPace}::${cacheText}`;
      const cached = ttsCache.get(cacheKey);
      if (cached) {
        res.json({ audio: cached, mimeType: 'audio/wav' });
        return;
      }

      const speechStyle =
        resolvedPace === 'slow'
          ? 'Native American English tutor for 7-9 year old beginners: speak very slowly, warmly, and gently, clearly articulating every word with brief natural pauses'
          : resolvedPace === 'moderate'
            ? 'Native American English tutor for 10-12 year old learners: speak at a calm, unhurried, clear pace with clean pronunciation'
            : 'Native American English speaker: natural native pronunciation and clear articulation for A1-A2 young learners';

      const callTts = (model: string) =>
        ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: cacheText,
                  speechMetadata: {
                    style: speechStyle,
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: 'Kore' },
              },
            },
          },
        });

      let response;
      try {
        response = await withTimeout(callTts('gemini-3.8-flash-lite-tts'), 12000, 'tts-lite');
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr ?? '');
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || isTransientError(firstErr)) {
          await new Promise((resolve) => setTimeout(resolve, 900));
          response = await withTimeout(callTts('gemini-3.8-flash-tts'), 12000, 'tts-flash');
        } else {
          throw firstErr;
        }
      }

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        res.status(502).json({ error: 'Non se puido xerar o audio.' });
        return;
      }

      if (ttsCache.size >= 250) {
        const oldestKey = ttsCache.keys().next().value;
        if (oldestKey) ttsCache.delete(oldestKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({ audio: base64Audio, mimeType: 'audio/wav' });
    } catch (err) {
      const formatted = formatGeminiErrorGl(err, 'Erro na síntese de voz.');
      console.error('/api/tts error:', err instanceof Error ? err.message : err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);

  const wss = new WebSocketServer({ server, path: '/ws/live' });
  wss.on('connection', (clientWs: WebSocket) => {
    let liveSession: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    let closed = false;

    clientWs.on('message', async (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.action === 'start') {
          const ai = getAiClient();
          if (!ai) {
            clientWs.send(
              JSON.stringify({
                type: 'error',
                error: 'Falta GEMINI_API_KEY para iniciar a conversa en vivo por voz.',
              })
            );
            clientWs.close();
            return;
          }

          const liveGrade = typeof payload.grade === 'string' ? payload.grade.trim() : '';
          const liveIsStarter =
            payload.ageTrack === '7-9' ||
            liveGrade === '2º Primaria' ||
            liveGrade === '3º Primaria' ||
            liveGrade === '4º Primaria';
          const liveIsEso = liveGrade === '1º ESO' || liveGrade === '2º ESO';
          const livePace =
            payload.speechPace === 'slow' ||
            payload.speechPace === 'moderate' ||
            payload.speechPace === 'standard'
              ? payload.speechPace
              : liveIsStarter
                ? 'slow'
                : liveIsEso
                  ? 'standard'
                  : 'moderate';

          const serverFallbackInstruction = [
            `You are ${payload.scenarioRole || 'a friendly English tutor'} in "${payload.scenarioTitleEn || 'Everyday English'}" (${payload.cefrLevel || 'A1'}) for a Galician student in ${liveGrade || (liveIsStarter ? '3º Primaria' : '5º Primaria')}.`,
            livePace === 'slow'
              ? 'SPEAKING PACE & DELIVERY (CRITICAL): Speak noticeably SLOWLY, warmly, and clearly, enunciating every word with brief pauses between phrases so a young beginner learner understands every word.'
              : livePace === 'moderate'
                ? 'SPEAKING PACE & DELIVERY: Speak at a calm, unhurried, clear pace with short natural pauses between sentences.'
                : 'SPEAKING PACE & DELIVERY: Speak clearly at a friendly, slightly unhurried A1-A2 pace.',
            liveIsStarter
              ? 'STRICT VOCABULARY: Use ONLY very basic A1 words and short 5-8 word sentences. Avoid idioms or phrasal verbs.'
              : liveIsEso
                ? 'VOCABULARY: Use everyday A1-A2 vocabulary and 2-3 concise sentences per turn.'
                : 'VOCABULARY: Use simple A1-A2 vocabulary and 1-2 short clear sentences per turn.',
            Array.isArray(payload.vocabularyList) && payload.vocabularyList.length > 0
              ? `Target vocabulary: ${payload.vocabularyList.slice(0, 12).join(', ')}.`
              : '',
          ]
            .filter(Boolean)
            .join('\n');

          liveSession = await ai.live.connect({
            model: 'gemini-3.8-live',
            config: {
              responseModalities: [Modality.AUDIO],
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: 'Zephyr' },
                },
              },
              systemInstruction: payload.systemInstruction || serverFallbackInstruction,
            },
            callbacks: {
              onopen: () => {
                if (!closed && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'open' }));
                }
              },
              onmessage: (message) => {
                if (closed || clientWs.readyState !== WebSocket.OPEN) return;
                const sc = message.serverContent;
                if (sc?.inputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ type: 'inputTranscript', text: sc.inputTranscription.text })
                  );
                }
                if (sc?.outputTranscription?.text) {
                  clientWs.send(
                    JSON.stringify({ type: 'outputTranscript', text: sc.outputTranscription.text })
                  );
                }
                if (sc?.turnComplete) {
                  clientWs.send(JSON.stringify({ type: 'turnComplete' }));
                }
                if (sc?.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }
                for (const part of sc?.modelTurn?.parts ?? []) {
                  if (part.inlineData?.data) {
                    clientWs.send(
                      JSON.stringify({ type: 'audio', data: part.inlineData.data })
                    );
                  }
                }
              },
              onerror: (e) => {
                const formatted = formatGeminiErrorGl(e, 'Non se puido manter a conexión de voz en vivo.');
                if (!closed && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({ type: 'error', error: formatted.message })
                  );
                }
              },
              onclose: () => {
                if (!closed && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ type: 'close' }));
                }
              },
            },
          });
          if (closed) {
            try {
              liveSession.close();
            } catch {
              // ignore
            }
            liveSession = null;
          }
        } else if (payload.action === 'input' && liveSession && payload.audio) {
          liveSession.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: 'audio/pcm;rate=16000',
            },
          });
        } else if (payload.action === 'text' && liveSession && payload.text) {
          liveSession.sendRealtimeInput({ text: payload.text });
        }
      } catch (err) {
        const formatted = formatGeminiErrorGl(err, 'Erro na sesión en vivo.');
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', error: formatted.message }));
        }
      }
    });

    clientWs.on('close', () => {
      closed = true;
      try {
        liveSession?.close();
      } catch {
        // ignore close error
      }
      liveSession = null;
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Falamos English server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
