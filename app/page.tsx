import { listTodos } from "@/lib/todos";
import { isProduction } from "@/lib/db";
import Shell from "@/components/Shell";
import TodoPanel from "@/components/TodoPanel";

export default async function Home() {
  const todos = await listTodos();
  const isPreview = !isProduction();

  return (
    <Shell
      items={[
        {
          id: "todo",
          label: "To-Do",
          content: <TodoPanel initialTodos={todos} isPreview={isPreview} />,
        },
      ]}
    />
  );
}
