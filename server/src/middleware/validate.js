// Validates req.body against a zod schema and replaces it with the parsed value.
// Parsing also coerces types, so a body like {"email": {"$ne": null}} is rejected
// instead of reaching a Mongo query (NoSQL operator injection).
export const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: 'Invalid request',
      errors: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  req.body = result.data;
  next();
};
