import type { Task, TaskStatus } from './task.types';
import type { TaskListProjection } from './task.projections';

/**
 * Task Validation Helpers
 * 
 * Centralizes common validation logic used across command handlers
 */

/**
 * Validate that a task exists
 * 
 * @param projection - The task projection to query
 * @param taskId - The task ID to validate
 * @returns The task if it exists
 * @throws Error if task not found
 */
export async function validateTaskExists(
  projection: TaskListProjection,
  taskId: string
): Promise<Task> {
  const task = await projection.getTaskById(taskId);
  
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }
  
  return task;
}

/**
 * Validate that a task exists and has the expected status
 * 
 * @param projection - The task projection to query
 * @param taskId - The task ID to validate
 * @param expectedStatus - The expected task status
 * @returns The task if it exists and has the expected status
 * @throws Error if task not found or has wrong status
 */
export async function validateTaskStatus(
  projection: TaskListProjection,
  taskId: string,
  expectedStatus: TaskStatus
): Promise<Task> {
  const task = await validateTaskExists(projection, taskId);
  
  if (task.status !== expectedStatus) {
    throw new Error(`Task ${taskId} is not ${expectedStatus} (status: ${task.status})`);
  }
  
  return task;
}
