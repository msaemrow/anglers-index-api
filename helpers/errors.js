const { randomUUID } = require("node:crypto");

class PublicError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const publicError = (status, message) => new PublicError(status, message);
const knownNames = new Set([
  "Error",
  "TypeError",
  "SyntaxError",
  "AxiosError",
  "SequelizeDatabaseError",
  "SequelizeConnectionError",
  "SequelizeConnectionRefusedError",
  "SequelizeValidationError",
  "SequelizeUniqueConstraintError",
  "SequelizeForeignKeyConstraintError",
  "MulterError",
]);

const knownCodes = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ECONNRESET",
  "ENOENT",
  "ENOSPC",
  "EACCES",
  "EAI_AGAIN",
  "ERR_NETWORK",
  "ERR_BAD_REQUEST",
  "ERR_BAD_RESPONSE",
  "23505",
  "23503",
  "23502",
  "22001",
  "22P02",
  "08006",
  "53300",
  "57014",
  "40001",
  "40P01",
]);

function logError(error, req, operation = "request") {
  // Never serialize an exception: Axios/Sequelize errors can contain secrets, SQL and input.
  console.error(
    JSON.stringify({
      level: "error",
      event: "request_failed",
      time: new Date().toISOString(),
      operation,
      requestId: req?.requestId,
      method: req?.method,
      route: typeof req?.route?.path === "string" ? req.route.path : undefined,
      userId: Number.isSafeInteger(req?.user?.id) ? req.user.id : undefined,
      errorType: knownNames.has(error?.name) ? error.name : "Error",
      code: knownCodes.has(error?.code) ? error.code : undefined,
    }),
  );
}

function sendError(
  res,
  error,
  req,
  message = "Unable to complete this request. Please try again.",
  status = 500,
) {
  if (
    error instanceof PublicError &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return res.status(error.status).json({ error: error.message });
  }
  logError(error, req);
  // Map known database input failures without exposing database messages/constraint names.
  if (error?.name === "SequelizeUniqueConstraintError")
    return res
      .status(409)
      .json({ error: "An item with those details already exists." });
  if (error?.name === "SequelizeValidationError")
    return res
      .status(400)
      .json({ error: "Some values are invalid. Check the submitted fields." });
  if (error?.name === "SequelizeForeignKeyConstraintError")
    return res
      .status(409)
      .json({ error: "The request conflicts with related records." });
  return res.status(status).json({ error: message });
}

function requestContext(req, res, next) {
  req.requestId = randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  next();
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    logError(error, req);
    return next(new Error("Response interrupted by an internal error."));
  }
  // Body-parser errors have fixed public messages; never reflect the parser's message/body.
  const parsingErrors = {
    "entity.parse.failed": [400, "Invalid JSON request body."],
    "entity.too.large": [413, "Request body is too large."],
    "encoding.unsupported": [415, "Unsupported request encoding."],
    "charset.unsupported": [415, "Unsupported request encoding."],
    "request.aborted": [400, "Request was interrupted."],
    "request.size.invalid": [400, "Invalid request size."],
  };
  const parsing = Object.hasOwn(parsingErrors, error?.type)
    ? parsingErrors[error.type]
    : null;
  if (parsing) {
    logError(error, req, "parse_request");
    return res.status(parsing[0]).json({ error: parsing[1] });
  }
  return sendError(res, error, req);
}

module.exports = {
  publicError,
  sendError,
  logError,
  requestContext,
  errorHandler,
};
