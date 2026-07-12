/** Identifies versioned engine data that cannot be read by this build. */
export type VersionedArtifact =
  "ofc-hand-event" | "ofc-hand-snapshot" | "ofc-match-snapshot";

/**
 * Typed compatibility error thrown when persisted data needs a migration that
 * this version of the engine does not provide.
 */
export class UnsupportedVersionError extends Error {
  readonly code = "unsupported-version";
  readonly artifact: VersionedArtifact;
  readonly receivedVersion: unknown;
  readonly supportedVersions: readonly number[];

  constructor(
    artifact: VersionedArtifact,
    receivedVersion: unknown,
    supportedVersions: readonly number[],
  ) {
    const supported = supportedVersions.join(", ");
    super(
      `Unsupported ${artifact} schema version ${String(receivedVersion)}; ` +
        `supported version${supportedVersions.length === 1 ? " is" : "s are"} ${supported}. ` +
        "Migrate the persisted data before restoring it.",
    );
    this.name = "UnsupportedVersionError";
    this.artifact = artifact;
    this.receivedVersion = receivedVersion;
    this.supportedVersions = Object.freeze([...supportedVersions]);
  }
}

/** Typed validation error for a supported snapshot with invalid contents. */
export class InvalidSnapshotError extends Error {
  readonly code = "invalid-snapshot";
  readonly artifact: Exclude<VersionedArtifact, "ofc-hand-event">;

  constructor(
    artifact: Exclude<VersionedArtifact, "ofc-hand-event">,
    message: string,
  ) {
    super(`Invalid ${artifact}: ${message}`);
    this.name = "InvalidSnapshotError";
    this.artifact = artifact;
  }
}
