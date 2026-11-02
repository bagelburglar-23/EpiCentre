"use server";

import { revalidatePath } from "next/cache";
import { addTodo, updateTodo, toggleTodo, deleteTodo } from "@/lib/todos";

export async function addTodoAction(
  title: string,
  details: string,
  dueDate: string,
  isTest: boolean,
  listId: number | null
) {
  addTodo(title, details, dueDate, isTest, listId);
  revalidatePath("/");
}

export async function updateTodoAction(
  id: number,
  title: string,
  details: string,
  dueDate: string,
  listId: number | null
) {
  updateTodo(id, title, details, dueDate, listId);
  revalidatePath("/");
}

export async function toggleTodoAction(id: number) {
  toggleTodo(id);
  revalidatePath("/");
}

export async function deleteTodoAction(id: number) {
  deleteTodo(id);
  revalidatePath("/");
}
