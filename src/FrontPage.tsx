import React from "react"
import { motion } from "motion/react"
import { ArrowRight, BookOpen, MessageSquare, Sparkles } from "lucide-react"

export function FrontPage() {
  // This will link to /app
  const goToApp = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    window.history.pushState({}, "", "/app")
    window.dispatchEvent(new Event("popstate"))
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground font-sans">
      {/* Navigation */}
      <nav className="flex items-center justify-between p-6 lg:px-12">
        <div className="flex items-center space-x-2">
          <BookOpen className="h-6 w-6" />
          <span className="font-heading text-xl font-bold tracking-tighter">Vox Libris</span>
        </div>
        <div>
          <a
            href="/app"
            onClick={goToApp}
            className="group flex items-center space-x-2 text-sm font-medium hover:text-primary/80 transition-colors"
          >
            <span>App</span>
            <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex flex-col items-center justify-center px-6 pt-24 pb-32 text-center lg:px-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="max-w-4xl space-y-8"
        >
          <div className="inline-flex items-center rounded-full border border-border bg-secondary/50 px-3 py-1 text-sm font-medium text-secondary-foreground backdrop-blur-sm">
            <Sparkles className="mr-2 h-4 w-4" />
            Dialogue littéraire IA
          </div>
          
          <h1 className="font-heading text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl">
            Redécouvrez les <br className="hidden sm:inline" />
            <span className="text-muted-foreground">Classiques</span>
          </h1>

          <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
            Conversez directement avec les œuvres complètes de <strong className="font-medium text-foreground">Victor Hugo</strong>, <strong className="font-medium text-foreground">Émile Zola</strong> et <strong className="font-medium text-foreground">Jules Verne</strong> grâce à un système RAG (Retrieval-Augmented Generation) avancé.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8">
            <a
              href="/app"
              onClick={goToApp}
              className="inline-flex items-center justify-center rounded-md bg-primary px-8 py-3 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 hover:scale-105 active:scale-95 duration-200"
            >
              Lancer l'application
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </motion.div>

        {/* Features Grids */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          className="mx-auto mt-24 grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-3 text-left"
        >
          <div className="flex flex-col space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
              <BookOpen className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-heading text-xl font-semibold">Œuvres Complètes</h3>
            <p className="text-muted-foreground leading-relaxed">
              Explorez l'intégralité des textes de nos trois auteurs fondateurs, indexés pour une recherche et une interaction instantanées.
            </p>
          </div>

          <div className="flex flex-col space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
              <MessageSquare className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-heading text-xl font-semibold">Dialogue Adaptatif</h3>
            <p className="text-muted-foreground leading-relaxed">
              Trois modes d'interaction : érudit pour la recherche, apprentissage pour l'étude, et jeune pour la découverte simplifiée.
            </p>
          </div>

          <div className="flex flex-col space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary">
              <Sparkles className="h-6 w-6 text-foreground" />
            </div>
            <h3 className="font-heading text-xl font-semibold">IA & RAG</h3>
            <p className="text-muted-foreground leading-relaxed">
              Une intelligence artificielle sourcée vérifie systématiquement ses réponses avec les véritables passages originaux.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <p>© 2026 Vox Libris — Éric Cappannelli</p>
      </footer>
    </div>
  )
}
