import { AppProvider } from "@/lib/data";
import { App } from "@/components/App";

export default function Home() {
  return (
    <AppProvider>
      <App />
    </AppProvider>
  );
}
