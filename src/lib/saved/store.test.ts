import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/saved", () => ({
  getSavedIds: vi.fn(),
  getSavedCount: vi.fn(),
  saveQuestion: vi.fn(),
  unsaveQuestion: vi.fn(),
}));

import * as api from "@/lib/api/saved";
import { getSavedState, loadSavedCount, loadSavedIds, resetSavedStore, setSaved, toggleSaved } from "./store";

const TOPIC = "topic-a";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  vi.resetAllMocks();
  resetSavedStore();
  vi.mocked(api.getSavedIds).mockResolvedValue(["q1"]);
  vi.mocked(api.getSavedCount).mockResolvedValue({ total: 1, limit: 1000, byTopic: [{ topicSlug: TOPIC, count: 1 }] });
  await Promise.all([loadSavedIds(), loadSavedCount()]);
});

describe("saved store", () => {
  it("saqlash: holat va badge soni server javobidan OLDIN o'zgaradi", async () => {
    const request = deferred<never>();
    vi.mocked(api.saveQuestion).mockReturnValue(request.promise);

    const { saved, done } = toggleSaved("q2", { topicSlug: "topic-b" });
    expect(saved).toBe(true);
    expect(getSavedState().ids.has("q2")).toBe(true);
    expect(getSavedState().count).toMatchObject({
      total: 2,
      byTopic: [
        { topicSlug: TOPIC, count: 1 },
        { topicSlug: "topic-b", count: 1 },
      ],
    });

    request.resolve(undefined as never);
    await done;
    expect(api.saveQuestion).toHaveBeenCalledWith("q2", "practice", undefined);
    expect(getSavedState().revision).toBe(1);
  });

  it("server xato bersa — holat va son orqaga qaytadi, xato chaqiruvchiga uzatiladi", async () => {
    vi.mocked(api.unsaveQuestion).mockRejectedValue(new Error("500"));

    const { saved, done } = toggleSaved("q1", { topicSlug: TOPIC });
    expect(saved).toBe(false);
    expect(getSavedState().ids.has("q1")).toBe(false);
    expect(getSavedState().count?.total).toBe(0);
    expect(getSavedState().count?.byTopic).toEqual([]);

    await expect(done).rejects.toThrow("500");
    expect(getSavedState().ids.has("q1")).toBe(true);
    expect(getSavedState().count).toMatchObject({ total: 1, byTopic: [{ topicSlug: TOPIC, count: 1 }] });
    expect(getSavedState().revision).toBe(0);
  });

  it("tez-tez bosish: so'rovlar navbat bilan, oxirgi holat saqlanadi", async () => {
    const first = deferred();
    vi.mocked(api.saveQuestion).mockReturnValueOnce(first.promise as never);
    vi.mocked(api.unsaveQuestion).mockResolvedValue(undefined);

    const a = setSaved("q3", true, { topicSlug: TOPIC });
    const b = setSaved("q3", false, { topicSlug: TOPIC });
    expect(getSavedState().ids.has("q3")).toBe(false);
    // Ikkinchi so'rov birinchisi tugaguncha yuborilmaydi.
    expect(api.unsaveQuestion).not.toHaveBeenCalled();

    first.resolve();
    await Promise.all([a, b]);
    expect(api.unsaveQuestion).toHaveBeenCalledTimes(1);
    expect(getSavedState().ids.has("q3")).toBe(false);
    expect(getSavedState().count?.total).toBe(1);
  });

  it("eski so'rov xatosi keyingi holatni buzmaydi", async () => {
    vi.mocked(api.saveQuestion).mockRejectedValueOnce(new Error("net"));
    vi.mocked(api.unsaveQuestion).mockResolvedValue(undefined);

    const a = setSaved("q4", true, { topicSlug: TOPIC });
    const b = setSaved("q4", false, { topicSlug: TOPIC });
    await expect(a).rejects.toThrow("net");
    await b;
    expect(getSavedState().ids.has("q4")).toBe(false);
    expect(getSavedState().count?.total).toBe(1);
  });

  it("imtihon rejimi — sourceMode va attemptId serverga uzatiladi", async () => {
    vi.mocked(api.saveQuestion).mockResolvedValue(undefined as never);
    await setSaved("q5", true, { topicSlug: TOPIC, sourceMode: "exam", attemptId: "att-1" });
    expect(api.saveQuestion).toHaveBeenCalledWith("q5", "exam", "att-1");
  });

  it("chiqishda holat tozalanadi", () => {
    resetSavedStore();
    expect(getSavedState()).toMatchObject({ idsStatus: "idle", count: null, revision: 0 });
    expect(getSavedState().ids.size).toBe(0);
  });
});
