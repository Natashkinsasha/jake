import type { JwtService } from "@nestjs/jwt";
import type { EnvService } from "@shared/shared-config/env.service";
import type { Socket } from "socket.io";
import type { LessonMaintainer } from "../../application/maintainer/lesson.maintainer";
import type { LessonSessionService } from "../../application/service/lesson-session.service";
import type { VoicePrintService } from "../../application/service/voice-print.service";
import { LessonGateway } from "./lesson.gateway";

interface StartedTurn {
  text: string;
  signal: AbortSignal;
  settle: () => void;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

function fakeSocket(id: string, userId = "u1") {
  return { id, data: { userId }, emit: jest.fn(), disconnect: jest.fn() } as unknown as Socket;
}

// A socket that still has to authenticate in handleConnection
function connectingSocket(id: string) {
  return {
    id,
    data: {},
    disconnected: false,
    handshake: { auth: { token: "token" }, query: {} },
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as Socket;
}

describe("LessonGateway turns", () => {
  let started: StartedTurn[];
  let maintainer: {
    processTextMessageStreaming: jest.Mock;
    endLesson: jest.Mock;
    startLesson: jest.Mock;
    scheduleFinalize: jest.Mock;
    cancelFinalize: jest.Mock;
  };
  let sessions: { get: jest.Mock; delete: jest.Mock; save: jest.Mock; markSeen: jest.Mock };
  let saved: unknown;
  let gateway: LessonGateway;

  beforeEach(() => {
    started = [];
    maintainer = {
      // Like the real maintainer: settles once the turn is stored, shortly after an abort
      processTextMessageStreaming: jest.fn(
        (_userId: string, text: string, _callbacks: unknown, options: { signal: AbortSignal }) =>
          new Promise<void>((resolve) => {
            started.push({ text, signal: options.signal, settle: resolve });
            options.signal.addEventListener("abort", () => setTimeout(resolve, 5));
          }),
      ),
      endLesson: jest.fn(async () => undefined),
      startLesson: jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          lessonId: "lesson-2",
          systemPrompt: "SYSTEM",
          voiceId: "voice",
          speechSpeed: 1,
          ttsModel: "tts",
          greeting: { rawText: "Hey!", text: "Hey!", emotion: "happy", vocabHighlights: [] },
          isOnboarding: false,
        };
      }),
      scheduleFinalize: jest.fn(async () => undefined),
      cancelFinalize: jest.fn(async () => undefined),
    };
    saved = { lessonId: "lesson-1", history: [] };
    sessions = {
      get: jest.fn(async () => saved),
      delete: jest.fn(async () => undefined),
      save: jest.fn(async (_userId: string, session: unknown) => {
        saved = session;
      }),
      markSeen: jest.fn(async () => undefined),
    };
    gateway = new LessonGateway(
      maintainer as unknown as LessonMaintainer,
      sessions as unknown as LessonSessionService,
      { verifyAsync: async () => ({ sub: "u1" }) } as unknown as JwtService,
      {} as VoicePrintService,
      { get: () => "test" } as unknown as EnvService,
    );
  });

  it("starts a new turn only after the interrupted one is stored", async () => {
    const socket = fakeSocket("s1");
    const first = gateway.handleText(socket, { text: "one" });
    await flush();

    const second = gateway.handleText(socket, { text: "two" });
    await flush();
    expect(started[0]?.signal.aborted).toBe(true);
    expect(started).toHaveLength(1);

    await first;
    await flush();
    expect(started.map((t) => t.text)).toEqual(["one", "two"]);

    started[1]?.settle();
    await second;
  });

  it("does not let a stale socket's disconnect stop the next socket's turn", async () => {
    const oldSocket = fakeSocket("old");
    const newSocket = fakeSocket("new");
    const first = gateway.handleText(oldSocket, { text: "one" });
    await flush();
    const second = gateway.handleText(newSocket, { text: "two" });
    await first;
    await flush();

    await gateway.handleDisconnect(oldSocket);
    expect(started[1]?.signal.aborted).toBe(false);

    started[1]?.settle();
    await second;
  });

  it("stores the turn in flight before ending the lesson", async () => {
    const socket = fakeSocket("s1");
    const turn = gateway.handleText(socket, { text: "bye" });
    await flush();

    await gateway.handleEndLesson(socket);

    expect(started[0]?.signal.aborted).toBe(true);
    expect(maintainer.endLesson).toHaveBeenCalledWith("lesson-1", []);
    expect(sessions.delete).toHaveBeenCalledWith("u1");
    await turn;
  });

  it("finalizes a lesson only after the student's last socket closes", async () => {
    const first = connectingSocket("a");
    const second = connectingSocket("b");
    await gateway.handleConnection(first);
    await gateway.handleConnection(second);
    expect(maintainer.cancelFinalize).toHaveBeenCalledWith("lesson-1");
    expect(sessions.markSeen).toHaveBeenCalledWith("u1");

    await gateway.handleDisconnect(first);
    expect(maintainer.scheduleFinalize).not.toHaveBeenCalled();
    await gateway.handleDisconnect(second);
    expect(maintainer.scheduleFinalize).toHaveBeenCalledWith("u1");
  });

  it("starts one lesson when two sockets connect at once", async () => {
    saved = null;
    const first = connectingSocket("a");
    const second = connectingSocket("b");

    await Promise.all([gateway.handleConnection(first), gateway.handleConnection(second)]);

    expect(maintainer.startLesson).toHaveBeenCalledTimes(1);
    expect(first.emit).toHaveBeenCalledWith("lesson_started", expect.anything());
    expect(second.emit).toHaveBeenCalledWith("lesson_resumed", expect.objectContaining({ lessonId: "lesson-2" }));
  });
});
