const { ZodError } = require("zod");

const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      // Parse validates the schema and strips out any unknown fields if strict mode isn't used
      // For req.body, we typically validate the body
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Format Zod errors into a readable structure
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        
        return res.status(400).json({
          message: "Validation failed",
          errors: formattedErrors,
        });
      }
      
      // Fallback for unexpected errors
      return res.status(500).json({
        message: "Internal server error during validation",
      });
    }
  };
};

module.exports = { validateRequest };
