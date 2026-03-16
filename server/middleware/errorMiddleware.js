export const errorHandler = (err, req, res, next) => {
    // If we didn't set a specific status code, default to 500
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    
    res.status(statusCode).json({
      message: err.message,
      // Only show stack trace in development mode for debugging
      stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
  };