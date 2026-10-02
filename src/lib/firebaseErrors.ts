import { FirebaseError } from 'firebase/app';

export function handleFirestoreError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case 'permission-denied':
        return 'You do not have permission to perform this action. Please check your role and access rights.';
      case 'not-found':
        return 'The requested document was not found.';
      case 'already-exists':
        return 'A document with this ID already exists.';
      case 'failed-precondition':
        return 'Operation failed due to a precondition. This might mean the document state is invalid for this operation.';
      case 'resource-exhausted':
        return 'Quota exceeded or rate limit reached. Please try again later.';
      case 'unauthenticated':
        return 'You must be logged in to perform this action.';
      default:
        return `Database error: ${error.message}`;
    }
  }
  
  if (error instanceof Error) {
    return `An unexpected error occurred: ${error.message}`;
  }
  
  return 'An unknown error occurred while communicating with the database.';
}
