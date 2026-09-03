import { describe, expect, it } from "vitest";

import { csvFilename, escapeField, toCsv } from "@/lib/csv";

import { makeApp } from "./factory";

describe("escapeField", () => {
  it("leaves an ordinary value alone", () => {
    expect(escapeField("Acme")).toBe("Acme");
  });

  it("quotes and doubles embedded quotes", () => {
    expect(escapeField('He said "hi"')).toBe('"He said ""hi"""');
  });

  it("quotes values containing a comma or newline", () => {
    expect(escapeField("Bengaluru, India")).toBe('"Bengaluru, India"');
    expect(escapeField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("defuses a leading formula character so Excel treats it as text", () => {
    expect(escapeField("=1+1")).toBe("'=1+1");
    expect(escapeField("-5 LPA")).toBe("'-5 LPA");
  });
});

describe("toCsv", () => {
  it("writes a header row plus one row per application", () => {
    const csv = toCsv([makeApp({ company: "Acme", role: "SDE" })]);
    const lines = csv.trimEnd().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0].startsWith("Company,Role,Status")).toBe(true);
    expect(lines[1].startsWith("Acme,SDE,Saved")).toBe(true);
  });

  it("renders nulls as empty cells and the boolean as yes/no", () => {
    const csv = toCsv([makeApp({ company: "Acme", location: null, coverLetter: true })]);
    expect(csv).toContain(",yes,");
    expect(csv).not.toContain("null");
  });

  it("still emits the header when there is nothing to export", () => {
    expect(toCsv([]).trimEnd().split("\r\n")).toHaveLength(1);
  });
});

describe("csvFilename", () => {
  it("stamps the date so downloads do not collide", () => {
    expect(csvFilename(new Date("2026-03-04T12:00:00.000Z"))).toBe("job-applications-2026-03-04.csv");
  });
});
