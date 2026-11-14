import { describe, expect, it } from "vitest";
import { parseAddress } from "./providers";

describe("parseAddress", () => {
  it("reads the standard OIDC address claim", () => {
    expect(
      parseAddress({ street_address: "15 Falls Rd\nApt 2", locality: "Shelburne", region: "VT", postal_code: "05482", country: "US" }),
    ).toEqual({ line1: "15 Falls Rd", line2: "Apt 2", city: "Shelburne", state: "VT", postalCode: "05482", country: "US" });
  });

  it("reads line_1/city-style keys and ignores empty claims", () => {
    expect(parseAddress({ line_1: "1 Main", city: "Burlington", country: "US" })).toMatchObject({ line1: "1 Main", city: "Burlington" });
    expect(parseAddress({})).toBeNull();
    expect(parseAddress("nope")).toBeNull();
  });
});
