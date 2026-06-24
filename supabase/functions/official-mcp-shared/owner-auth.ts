export type OfficialMcpOwnerAuthDependencies = {
  getUser: (authorization: string) => Promise<unknown>;
};

export type OfficialMcpAuthenticatedOwner = {
  ownerUserId: string;
};

export type OfficialMcpSafeErrorCode =
  | "unauthorized"
  | "requested_binding_not_found"
  | "server_error";

export class OfficialMcpSafeError extends Error {
  readonly status: number;
  readonly code: OfficialMcpSafeErrorCode;
  readonly safeMessage: string;

  constructor(
    status: number,
    code: OfficialMcpSafeErrorCode,
    safeMessage: string,
  ) {
    super(safeMessage);
    this.name = "OfficialMcpSafeError";
    this.status = status;
    this.code = code;
    this.safeMessage = safeMessage;
  }
}

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function isOfficialMcpCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && canonicalUuidPattern.test(value);
}

function unauthorized(): OfficialMcpSafeError {
  return new OfficialMcpSafeError(401, "unauthorized", "Unauthorized.");
}

export function readOfficialMcpBearerAuthorization(request: Request): string {
  const header = request.headers.get("authorization");
  if (typeof header !== "string") throw unauthorized();

  const match = /^Bearer ([^\s]+)$/iu.exec(header);
  if (!match) throw unauthorized();

  return `Bearer ${match[1]}`;
}

function readUserId(candidate: unknown): unknown {
  if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
    return undefined;
  }

  const record = candidate as Record<string, unknown>;
  if (typeof record.id === "string") return record.id;

  const user = record.user;
  if (user && !Array.isArray(user) && typeof user === "object") {
    const id = (user as Record<string, unknown>).id;
    if (typeof id === "string") return id;
  }

  const data = record.data;
  if (data && !Array.isArray(data) && typeof data === "object") {
    const dataUser = (data as Record<string, unknown>).user;
    if (dataUser && !Array.isArray(dataUser) && typeof dataUser === "object") {
      const id = (dataUser as Record<string, unknown>).id;
      if (typeof id === "string") return id;
    }
  }

  return undefined;
}

export async function authenticateOfficialMcpOwner(
  authorization: string,
  dependencies: OfficialMcpOwnerAuthDependencies,
): Promise<OfficialMcpAuthenticatedOwner> {
  if (!/^Bearer [^\s]+$/iu.test(authorization)) throw unauthorized();

  let user: unknown;
  try {
    user = await dependencies.getUser(authorization);
  } catch {
    throw unauthorized();
  }

  const ownerUserId = readUserId(user);
  if (!isOfficialMcpCanonicalUuid(ownerUserId)) throw unauthorized();

  return { ownerUserId };
}
