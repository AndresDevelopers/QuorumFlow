'use client';

import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MessageCircle, Plus, History, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

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

const STORAGE_KEY = 'church-chat-sessions-v1';

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

const loadSessions = (): ChatSession[] => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [makeSession()];
    }
    const parsed = JSON.parse(raw) as ChatSession[];
    return parsed.length > 0 ? parsed : [makeSession()];
  } catch {
    return [makeSession()];
  }
};

const saveSessions = (sessions: ChatSession[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
};

export default function ChurchChatPage() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<ChatSession[]>(() => [makeSession()]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (!activeSessionId && sessions.length > 0) {
      setActiveSessionId(sessions[0].id);
    }
  }, [activeSessionId, sessions]);
  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? sessions[0],
    [activeSessionId, sessions]
  );

  const updateSessions = (updater: (current: ChatSession[]) => ChatSession[]) => {
    setSessions((current) => {
      const next = updater(current);
      saveSessions(next);
      return next;
    });
  };

  const handleNewChat = () => {
    const next = makeSession();
    updateSessions((current) => [next, ...current]);
    setActiveSessionId(next.id);
    setInput('');
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
                <button
                  type="button"
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`w-full rounded-md border p-2 text-left text-sm transition hover:bg-muted ${
                    activeSession?.id === session.id ? 'border-primary bg-muted' : 'border-border'
                  }`}
                >
                  <p className="line-clamp-1 font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(session.createdAt), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                </button>
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
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </article>
              ))}
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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
