import { describe, expect, it } from "vitest";
import {
  MAX_CHAT_IMAGE_BYTES,
  chatImageContentType,
  chatImageExtension,
  detectChatImageType,
} from "./images";

describe("detectChatImageType", () => {
  it("detects JPEG by its magic bytes", () => {
    expect(detectChatImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe("jpeg");
  });

  it("detects PNG by its signature", () => {
    expect(detectChatImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]))).toBe("png");
  });

  it("detects WebP by its RIFF/WEBP header", () => {
    expect(
      detectChatImageType(
        new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20])
      )
    ).toBe("webp");
  });

  it("rejects a RIFF header that is not WEBP", () => {
    expect(
      detectChatImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45]))
    ).toBeNull();
  });

  it("returns null for empty or too-short input", () => {
    expect(detectChatImageType(new Uint8Array([]))).toBeNull();
    expect(detectChatImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  it("returns null for plain text", () => {
    expect(detectChatImageType(new TextEncoder().encode("hello world, not an image"))).toBeNull();
  });
});

describe("chatImageContentType", () => {
  it("returns the MIME type for each image type", () => {
    expect(chatImageContentType("jpeg")).toBe("image/jpeg");
    expect(chatImageContentType("png")).toBe("image/png");
    expect(chatImageContentType("webp")).toBe("image/webp");
  });
});

describe("chatImageExtension", () => {
  it("returns the file extension for each image type", () => {
    expect(chatImageExtension("jpeg")).toBe("jpg");
    expect(chatImageExtension("png")).toBe("png");
    expect(chatImageExtension("webp")).toBe("webp");
  });
});

describe("MAX_CHAT_IMAGE_BYTES", () => {
  it("is 4,000,000", () => {
    expect(MAX_CHAT_IMAGE_BYTES).toBe(4_000_000);
  });
});
