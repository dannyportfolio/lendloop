import { Navbar } from "@/components/shared/Navbar";
import { Hero } from "@/components/public/Hero";
import { PublicDirectory } from "@/components/public/PublicDirectory";
import { HowItWorks } from "@/components/public/HowItWorks";
import { Footer } from "@/components/shared/Footer";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <PublicDirectory />
        <HowItWorks />
      </main>
      <Footer />
    </div>
  );
}
