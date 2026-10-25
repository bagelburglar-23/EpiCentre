"use server";

import { revalidatePath } from "next/cache";
import { addTodo, toggleTodo, deleteTodo } from "@/lib/todos";

export async function addTodoAction(text: string, isTest: boolean) {
  addTodo(text, isTest);
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
