// Base class for application-specific errors
export class AppError extends Error {
  public readonly userFriendlyMessage: string;
  public readonly originalError?: any;
  public readonly statusCode?: number; // For HTTP errors

  constructor(message: string, userFriendlyMessage: string, originalError?: any, statusCode?: number) {
    super(message);
    this.name = this.constructor.name;
    this.userFriendlyMessage = userFriendlyMessage;
    this.originalError = originalError;
    this.statusCode = statusCode;
    //This is important for extending built-in Error class in TypeScript
    Object.setPrototypeOf(this, new.target.prototype); 
  }
}

// Specific error types
export class NetworkError extends AppError {
  constructor(originalError?: any, userFriendlyMessage: string = "A network error occurred. Please check your internet connection and try again.") {
    super("NetworkError", userFriendlyMessage, originalError);
  }
}

export class ApiError extends AppError {
  constructor(
    message: string = "APIError",
    userFriendlyMessage: string = "An unexpected error occurred while communicating with the server. Please try again later.",
    originalError?: any,
    statusCode?: number
  ) {
    super(message, userFriendlyMessage, originalError, statusCode);
  }
}

export class NotFoundError extends ApiError {
  constructor(
    resourceName: string = "Resource",
    userFriendlyMessage?: string,
    originalError?: any
  ) {
    const defaultFriendlyMessage = `${resourceName} not found. Please check the information provided.`;
    super(
      `${resourceName}NotFound`,
      userFriendlyMessage || defaultFriendlyMessage,
      originalError,
      404
    );
  }
}

export class NoResultsError extends AppError {
  constructor(
    searchTerm: string = "your query",
    userFriendlyMessage?: string
  ) {
    const defaultFriendlyMessage = `No results found for "${searchTerm}". Try refining your search.`;
    super(
      `NoResultsError for ${searchTerm}`,
      userFriendlyMessage || defaultFriendlyMessage
    );
  }
}

export class ValidationError extends AppError {
  public readonly validationErrors?: Record<string, string>;

  constructor(
    userFriendlyMessage: string = "Invalid input. Please check the provided data.",
    validationErrors?: Record<string, string>,
    originalError?: any
  ) {
    super("ValidationError", userFriendlyMessage, originalError);
    this.validationErrors = validationErrors;
  }
}

// You can add more specific error types as needed, e.g.:
// export class AuthenticationError extends AppError { ... }
// export class AuthorizationError extends AppError { ... }
// export class ApiLimitError extends ApiError { ... }

export class AuthenticationError extends AppError {
  constructor(
    userFriendlyMessage: string = "Authentication failed. Please log in again.",
    originalError?: any
  ) {
    super("AuthenticationError", userFriendlyMessage, originalError, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(
    userFriendlyMessage: string = "You do not have permission to perform this action.",
    originalError?: any
  ) {
    super("AuthorizationError", userFriendlyMessage, originalError, 403);
  }
}

/**
 * Helper function to determine the type of error and return an AppError instance.
 * This is particularly useful for handling errors from libraries like Axios.
 */
export const handleError = (error: any, context?: string): AppError => {
  const serviceContext = context ? ` in ${context}` : "";

  if (error instanceof AppError) {
    return error; // If it's already an AppError, just return it
  }

  if (error && typeof error.isAxiosError === 'boolean' && error.isAxiosError) {
    const axiosError = error;
    if (axiosError.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      const { status, data } = axiosError.response;
      const apiMessage = (data && typeof data.message === 'string' ? data.message : axiosError.message) || `HTTP ${status}`;
      let userMessage = `An API error (status: ${status}) occurred${serviceContext}.`;

      if (status === 404) {
        return new NotFoundError(context || "Resource", `The requested resource was not found${serviceContext}.`, axiosError);
      }
      if (status === 400) {
         userMessage = `Invalid request${serviceContext}. Please check your input.`;
         return new ValidationError(userMessage, data && typeof data.errors === 'object' ? data.errors : undefined, axiosError);
      }
      if (status === 401) {
        return new AuthenticationError(data && typeof data.message === 'string' ? data.message : undefined, axiosError); 
      }
      if (status === 403) {
        return new AuthorizationError(data && typeof data.message === 'string' ? data.message : undefined, axiosError);
      }
      if (status === 429) {
        userMessage = `Too many requests${serviceContext}. Please try again later.`;
      } else if (status >= 500) {
        userMessage = `A server error occurred${serviceContext}. Please try again later.`;
      }
      
      return new ApiError(apiMessage, userMessage, axiosError, status);
    } else if (axiosError.request) {
      // The request was made but no response was received
      return new NetworkError(axiosError, `No response received from server${serviceContext}. Check your internet connection.`);
    } else {
      // Axios error, but not a response or request error (e.g., setup error)
      console.error(`Unhandled Axios error${serviceContext}:`, axiosError);
      return new AppError(
        axiosError.message || "AxiosSetupError",
        `An unexpected error occurred with the request setup${serviceContext}.`,
        axiosError
      );
    }
  }

  // Generic JavaScript error or other unknown error
  let errorMessage = "UnknownError";
  if (error && typeof error.message === 'string') {
    errorMessage = error.message;
  }
  console.error(`Unhandled error${serviceContext}:`, error);
  return new AppError(
    errorMessage,
    `An unexpected error occurred${serviceContext}. Please try again.`,
    error
  );
}; 