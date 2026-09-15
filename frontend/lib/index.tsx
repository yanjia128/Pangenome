import React, { Suspense, lazy } from "react";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { Routes, Route, BrowserRouter, Navigate } from "react-router-dom";
import { ROUTES } from "./routes";
import { FullScreenLoading } from "./components/full-screen-loading";
import { Topbar } from "./components/topbar";
import "./index.css";

const HomePage = lazy(() => import("./pages/home"));
const BlogPage = lazy(() => import("./pages/blog"));
const PublicationPage = lazy(() => import("./pages/publication"));
const OrthogroupsPage = lazy(() => import("./pages/orthogroups"));
const PhylocanvasPage = lazy(() => import("./pages/phylocanvas"));
const TranscriptomePage = lazy(() => import("./pages/transcriptome"));
const EnrichmentPage = lazy(() => import("./pages/enrichment"));
const JBrowsePage = lazy(() => import("./pages/jbrowse"));
const AnalysisPage = lazy(() => import("./pages/analsis"));
const AnnotationPage = lazy(() => import("./pages/annotation"));
const ContactPage = lazy(() => import("./pages/contact"));

dayjs.extend(LocalizedFormat);

const ROUTER_BASENAME =
  typeof window !== "undefined" &&
  window.location.pathname.startsWith("/dendrobium")
    ? "/dendrobium"
    : "";

export function Root() {
  return (
    <BrowserRouter basename={ROUTER_BASENAME}>
      <Topbar />
      <Routes>
        <Route
          path={ROUTES.LANDING_PAGE}
          element={<Navigate to={ROUTES.HOME} replace />}
        />
        <Route
          path={ROUTES.HOME}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <HomePage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.ANNOTATION}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <AnnotationPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.STATISTICS}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <AnalysisPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.BLOG}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <BlogPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.PUBLICATION_PAGE}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <PublicationPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.ORTHOGROUPS}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <OrthogroupsPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.PHYLOCANVAS}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <PhylocanvasPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.TRANSCRIPTOME}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <TranscriptomePage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.ENRICHMENT}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <EnrichmentPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.SYNTENY}
          element={
            <Suspense fallback={<FullScreenLoading />}>
              <JBrowsePage />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.LEGACY_ANALYSIS}
          element={<Navigate to={ROUTES.STATISTICS} replace />}
        />
        <Route
          path={ROUTES.CONTACT}
          element={
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <ContactPage />
              </Suspense>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
