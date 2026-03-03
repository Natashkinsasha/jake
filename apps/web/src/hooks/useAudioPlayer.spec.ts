import { renderHook, act } from "@testing-library/react";
import { useAudioPlayer } from "./useAudioPlayer";

// Mock Audio
const mockPlay = jest.fn().mockResolvedValue(undefined);
const mockPause = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  global.Audio = jest.fn().mockImplementation(() => ({
    play: mockPlay,
    pause: mockPause,
    currentTime: 0,
    onplay: null,
    onended: null,
    onpause: null,
  })) as any;
  global.URL.createObjectURL = jest.fn().mockReturnValue("blob:mock-url");
  global.URL.revokeObjectURL = jest.fn();
});

describe("useAudioPlayer", () => {
  it("starts not playing", () => {
    const { result } = renderHook(() => useAudioPlayer());
    expect(result.current.isPlaying).toBe(false);
  });

  it("calls Audio with base64 data URI", () => {
    const { result } = renderHook(() => useAudioPlayer());
    act(() => {
      result.current.play("dGVzdA==");
    });
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(global.Audio).toHaveBeenCalledWith("blob:mock-url");
    expect(mockPlay).toHaveBeenCalled();
  });

  it("stops audio playback", () => {
    const { result } = renderHook(() => useAudioPlayer());
    act(() => {
      result.current.play("dGVzdA==");
    });
    act(() => {
      result.current.stop();
    });
    expect(result.current.isPlaying).toBe(false);
  });
});
