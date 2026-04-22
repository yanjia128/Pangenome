import React, { Suspense, lazy } from "react";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
import { Routes, Route, BrowserRouter } from "react-router-dom";
import { ROUTES } from "./routes";
import { FullScreenLoading } from "./components/full-screen-loading";
import { Topbar } from "./components/topbar";
import "./index.css";

const LandingPage = lazy(() => import("./pages/landing"));
const HomePage = lazy(() => import("./pages/home"));
const BlogPage = lazy(() => import("./pages/blog"));
const PublicationPage = lazy(() => import("./pages/publication"));
const OrthogroupsPage = lazy(() => import("./pages/orthogroups"));
const PhyloxoniumPage = lazy(() => import("./pages/phyloxonnium"));
const PhylocanvasPage = lazy(() => import("./pages/phylocanvas"));
const TranscriptomePage = lazy(() => import("./pages/transcriptome"));
const JBrowsePage = lazy(() => import("./pages/jbrowse"));
const AnalysisPage = lazy(() => import("./pages/analsis"));

dayjs.extend(LocalizedFormat);

export function Root() {
  return (
    <BrowserRouter>
      <Topbar />
      <Routes>
        <Route
          path={ROUTES.LANDING_PAGE}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <LandingPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.HOME}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <HomePage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.ANALYSIS}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <AnalysisPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.BLOG}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <BlogPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.PUBLICATION_PAGE}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <PublicationPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.ORTHOGROUPS}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <OrthogroupsPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.PHYLOCANVAS}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <PhylocanvasPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.PHYLOXONIUM}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <PhyloxoniumPage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.TRANSCRIPTOME}
          element={
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <Suspense fallback={<FullScreenLoading />}>
                <TranscriptomePage />
              </Suspense>
            </div>
          }
        />
        <Route
          path={ROUTES.JBROWSE}
          element={
            <Suspense fallback={<FullScreenLoading />}>
              <JBrowsePage />
            </Suspense>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
