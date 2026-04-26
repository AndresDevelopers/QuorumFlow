'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Loader2, MessageCircle, Plus, Trash2 } from 'lucide-react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import { firestore } from '@/lib/firebase';
import logger from '@/lib/logger';

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  messages: ChatMessage[];
};

type ChatStoreDocument = {
  sessions?: ChatSession[];
};

const STORAGE_KEY = 'church-chat-sessions-v1';
const MAX_SESSIONS = 25;

const makeInitialAssistantMessage = (): ChatMessage => ({
  id: crypto.randomUUID(),
  role: 'assistant',
  content:
    '¡Hola! Este chat está dedicado exclusivamente a temas oficiales de La Iglesia de Jesucristo de los Santos de los Últimos Días. ¿Qué te gustaría estudiar hoy?',
  createdAt: new Date().toISOString(),
});

const makeSession = (): ChatSession => ({
  id: crypto.randomUUID(),
  title: 'Nuevo chat',
  createdAt: new Date().toISOString(),
  messages: [makeInitialAssistantMessage()],
});

const toBoundedSessions = (sessions: ChatSession[]): ChatSession[] => sessions.slice(0, MAX_SESSIONS);

const loadSessionsFromLocal = (): ChatSession[] => {
  if (typeof window === 'undefined') return [makeSession()];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [makeSession()];

    const parsed = JSON.parse(raw) as ChatSession[];
    return parsed.length > 0 ? toBoundedSessions(parsed) : [makeSession()];
  } catch {
    return [makeSession()];
  }
};

const saveSessionsToLocal = (sessions: ChatSession[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toBoundedSessions(sessions)));
};

const getInlineNodes = (text: string): ReactNode[] => {
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).filter(Boolean);
  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={`inline-${index}`}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('*') && token.endsWith('*')) {
      return <em key={`inline-${index}`}>{token.slice(1, -1)}</em>;
    }
    return token;
  });
};

function FormattedMessage({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: Array<{ type: 'p'; text: string } | { type: 'ul'; items: string[] }> = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const bullet = trimmed.match(/^[-*]\s+(.+)$/);

    if (bullet) {
      const current = blocks[blocks.length - 1];
      if (current && current.type === 'ul') {
        current.items.push(bullet[1]);
      } else {
        blocks.push({ type: 'ul', items: [bullet[1]] });
      }
      continue;
    }

    if (!trimmed) {
      blocks.push({ type: 'p', text: '' });
      continue;
    }

    blocks.push({ type: 'p', text: line });
  }

  return (
    <div className="space-y-2 whitespace-pre-wrap">
      {blocks.map((block, index) => {
        if (block.type === 'ul') {
          return (
            <ul key={`block-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`item-${itemIndex}`}>{getInlineNodes(item)}</li>
              ))}
            </ul>
          );
        }

        if (!block.text) {
          return <div key={`block-${index}`} className="h-2" />;
        }

        return <p key={`block-${index}`}>{getInlineNodes(block.text)}</p>;
      })}
    </div>
  );
}

export default function ChurchChatPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>(() => [makeSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const persistSessions = useCallback(async (nextSessions: ChatSession[]) => {
    const bounded = toBoundedSessions(nextSessions);
    saveSessionsToLocal(bounded);

    if (!user?.uid) return;

    try {
      const ref = doc(firestore, 'users', user.uid, 'appData', 'churchChat');
      await setDoc(
        ref,
        {
          sessions: bounded,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      logger.warn({ error, message: 'No fue posible guardar historial de church-chat en Firestore.' });
    }
  }, [user?.uid]);

  const updateSessions = (updater: (current: ChatSession[]) => ChatSession[]) => {
    setSessions((current) => {
      const next = toBoundedSessions(updater(current));
      void persistSessions(next);
      return next;
    });
  };

  useEffect(() => {
    const bootstrap = async () => {
      const localSessions = loadSessionsFromLocal();
      setSessions(localSessions);

      if (!user?.uid) {
        return;
      }

      try {
        const ref = doc(firestore, 'users', user.uid, 'appData', 'churchChat');
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) {
          void persistSessions(localSessions);
          return;
        }

        const payload = snapshot.data() as ChatStoreDocument;
        if (Array.isArray(payload.sessions) && payload.sessions.length > 0) {
          const cloudSessions = toBoundedSessions(payload.sessions);
          setSessions(cloudSessions);
          saveSessionsToLocal(cloudSessions);
        }
      } catch (error) {
        logger.warn({ error, message: 'Firestore no disponible para church-chat, se mantiene localStorage.' });
      }
    };

    void bootstrap();
  }, [persistSessions, user?.uid]);

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);

  const handleNewChat = () => {
    const next = makeSession();
    updateSessions((current) => [next, ...current]);
    setActiveSessionId(next.id);
    setInput('');
  };

  const handleDeleteSession = (sessionId: string) => {
    updateSessions((current) => {
      const filtered = current.filter((session) => session.id !== sessionId);
      if (filtered.length === 0) {
        const replacement = makeSession();
        setActiveSessionId(replacement.id);
        return [replacement];
      }

      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const handleSend = async () => {
    const value = input.trim();
    if (!value || loading || !activeSession) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: value,
      createdAt: new Date().toISOString(),
    };

    setInput('');
    setLoading(true);

    let draftMessages: ChatMessage[] = [];

    updateSessions((current) =>
      current.map((session) => {
        if (session.id !== activeSession.id) return session;
        draftMessages = [...session.messages, userMessage];
        return {
          ...session,
          title: session.messages.length <= 1 ? value.slice(0, 60) : session.title,
          messages: draftMessages,
        };
      })
    );

    try {
      const history = draftMessages
        .filter((message) => message.id !== userMessage.id)
        .slice(-12)
        .map((message) => ({ role: message.role, content: message.content }));

      const response = await fetch('/api/church-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: value, history }),
      });

      const payload = (await response.json()) as { answer?: string; error?: string };

      if (!response.ok || !payload.answer) {
        throw new Error(payload.error ?? 'No fue posible responder en este momento.');
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: payload.answer,
        createdAt: new Date().toISOString(),
      };

      updateSessions((current) =>
        current.map((session) => {
          if (session.id !== activeSession.id) return session;
          return {
            ...session,
            messages: [...session.messages, assistantMessage],
          };
        })
      );
    } catch (error) {
      toast({
        title: 'No se pudo enviar el mensaje',
        description: error instanceof Error ? error.message : 'Error inesperado.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" /> Historial
          </CardTitle>
          <CardDescription>Accede a conversaciones anteriores o inicia una nueva.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" onClick={handleNewChat}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo chat
          </Button>
          <ScrollArea className="h-[420px] rounded-md border p-2">
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center gap-2 rounded-md border p-2 transition hover:bg-muted ${
                    activeSession?.id === session.id ? 'border-primary bg-muted' : 'border-border'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveSessionId(session.id)}
                    className="min-h-11 flex-1 text-left"
                  >
                    <p className="line-clamp-1 font-medium text-sm">{session.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(session.createdAt), 'd MMM yyyy, HH:mm', { locale: es })}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11"
                    onClick={() => handleDeleteSession(session.id)}
                    aria-label={`Eliminar conversación ${session.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5" /> Chat del Evangelio (Oficial)
          </CardTitle>
          <CardDescription>
            Este asistente responde únicamente temas de la Iglesia con base en fuentes oficiales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[460px] rounded-md border p-3">
            <div className="space-y-3">
              {activeSession?.messages.map((message) => (
                <article
                  key={message.id}
                  className={`max-w-[90%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    message.role === 'user'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  <FormattedMessage content={message.content} />
                </article>
              ))}
              {loading && (
                <article className="max-w-[90%] rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>La IA está escribiendo...</span>
                  </div>
                </article>
              )}
            </div>
          </ScrollArea>

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Escribe una pregunta sobre el evangelio, doctrina, manuales o noticias oficiales..."
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSend();
                }
              }}
              disabled={loading}
            />
            <Button onClick={() => void handleSend()} disabled={loading || input.trim().length === 0}>
              Enviar
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
