import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const SOUL_DIR = join(__dirname, "..", "soul");

describe("WS4: World Bible active drive updates", () => {
  const worldBible = JSON.parse(
    readFileSync(join(SOUL_DIR, "world-bible.json"), "utf-8"),
  );
  const touko = worldBible.characters["御鐘透心"];
  const tsurugi = worldBible.characters["愛原つるぎ"];

  it("御鐘透心に active_drive が存在する", () => {
    expect(touko).toHaveProperty("active_drive");
    expect(typeof touko.active_drive).toBe("string");
    expect(touko.active_drive.length).toBeGreaterThan(0);
  });

  it("御鐘透心に action_patterns が存在する", () => {
    expect(touko).toHaveProperty("action_patterns");
    expect(Array.isArray(touko.action_patterns)).toBe(true);
    expect(touko.action_patterns.length).toBeGreaterThan(0);
  });

  it("愛原つるぎに active_drive が存在する", () => {
    expect(tsurugi).toHaveProperty("active_drive");
    expect(typeof tsurugi.active_drive).toBe("string");
    expect(tsurugi.active_drive.length).toBeGreaterThan(0);
  });

  it("愛原つるぎに action_patterns が存在する", () => {
    expect(tsurugi).toHaveProperty("action_patterns");
    expect(Array.isArray(tsurugi.action_patterns)).toBe(true);
    expect(tsurugi.action_patterns.length).toBeGreaterThan(0);
  });

  it("愛原つるぎに diverse_roles が存在する", () => {
    expect(tsurugi).toHaveProperty("diverse_roles");
    expect(typeof tsurugi.diverse_roles).toBe("string");
    expect(tsurugi.diverse_roles.length).toBeGreaterThan(0);
  });

  it("御鐘透心の既存フィールドが維持されている", () => {
    expect(touko).toHaveProperty("reading", "みかね とうこ");
    expect(touko).toHaveProperty("role", "学級委員長、主人公");
    expect(touko).toHaveProperty("core");
    expect(touko).toHaveProperty("voice");
    expect(touko).toHaveProperty("symbol");
    expect(touko).toHaveProperty("relationships");
    expect(touko).toHaveProperty("inner_wound");
    expect(touko).toHaveProperty("killing_nature");
    expect(touko).toHaveProperty("traits");
  });

  it("愛原つるぎの既存フィールドが維持されている", () => {
    expect(tsurugi).toHaveProperty("reading", "あいはら つるぎ");
    expect(tsurugi).toHaveProperty("role", "ハッカー、二重スパイ（自称）");
    expect(tsurugi).toHaveProperty("core");
    expect(tsurugi).toHaveProperty("desire");
    expect(tsurugi).toHaveProperty("voice");
    expect(tsurugi).toHaveProperty("pattern");
    expect(tsurugi).toHaveProperty("traits");
    expect(tsurugi).toHaveProperty("relationships");
    expect(tsurugi).toHaveProperty("core_metaphor");
    expect(tsurugi).toHaveProperty("relationship_to_touko");
  });
});

describe("WS5: Anti-Soul passive_narrative updates", () => {
  const antiSoul = JSON.parse(
    readFileSync(join(SOUL_DIR, "anti-soul.json"), "utf-8"),
  );

  it("passive_narrative カテゴリが存在する", () => {
    expect(antiSoul.categories).toHaveProperty("passive_narrative");
    expect(Array.isArray(antiSoul.categories.passive_narrative)).toBe(true);
    expect(antiSoul.categories.passive_narrative.length).toBe(3);
  });

  it("passive_narrative の各エントリに必須フィールドがある", () => {
    for (const entry of antiSoul.categories.passive_narrative) {
      expect(entry).toHaveProperty("id");
      expect(entry).toHaveProperty("text");
      expect(entry).toHaveProperty("reason");
      expect(entry).toHaveProperty("source");
      expect(entry).toHaveProperty("added_at");
    }
  });

  it("violation_mapping に passive_narrative が含まれる", () => {
    expect(antiSoul.violation_mapping).toHaveProperty("passive_narrative");
    expect(antiSoul.violation_mapping.passive_narrative).toBe(
      "passive_narrative",
    );
  });

  it("既存カテゴリが維持されている", () => {
    expect(antiSoul.categories).toHaveProperty("excessive_sentiment");
    expect(antiSoul.categories).toHaveProperty("explanatory_worldbuilding");
    expect(antiSoul.categories).toHaveProperty("character_normalization");
    expect(antiSoul.categories).toHaveProperty("mentor_tsurgi");
    expect(antiSoul.categories).toHaveProperty("lion_concretization");
    expect(antiSoul.categories).toHaveProperty("cliche_simile");
    expect(antiSoul.categories).toHaveProperty("theme_violation");
    expect(antiSoul.categories).toHaveProperty("ar_reality_cliche");
    expect(antiSoul.categories).toHaveProperty("structural_monotony");
    expect(antiSoul.categories).toHaveProperty("symbolic_explanation");
  });

  it("既存の violation_mapping エントリが維持されている", () => {
    expect(antiSoul.violation_mapping).toHaveProperty("symbolic_explanation");
    expect(antiSoul.violation_mapping).toHaveProperty("theme_violation");
    expect(antiSoul.violation_mapping).toHaveProperty("forbidden_word");
    expect(antiSoul.violation_mapping).toHaveProperty("forbidden_simile");
  });
});
