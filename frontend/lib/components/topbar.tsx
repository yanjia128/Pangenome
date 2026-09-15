import React from "react";
import { MegaMenu, Navbar } from "flowbite-react";
import { ROUTES, useRouter } from "../routes";

const NAV_ITEMS = [
  { label: "Home", route: ROUTES.HOME },
  { label: "Statistics", route: ROUTES.STATISTICS },
  { label: "Annotation", route: ROUTES.ANNOTATION },
  { label: "Group", route: ROUTES.ORTHOGROUPS },
  { label: "Transcriptome(DGA)", route: ROUTES.TRANSCRIPTOME },
  { label: "Enrichment Analysis", route: ROUTES.ENRICHMENT },
  // { label: "Phylogene Tree", route: ROUTES.PHYLOCANVAS },
  //{ label: "Synteny", route: ROUTES.SYNTENY },
  //{ label: "Contact", route: ROUTES.CONTACT },
];

export function Topbar() {
  const { push, pathname } = useRouter();

  const isActiveRoute = (route: string) => {
    if (route === ROUTES.HOME) {
      return pathname === ROUTES.HOME || pathname === ROUTES.LANDING_PAGE;
    }
    return pathname === route;
  };

  const getNavLinkClass = (active: boolean) =>
    active
      ? "cursor-pointer rounded-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-amber-400 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_24px_-16px_rgba(217,70,239,0.75)] transition-all duration-200"
      : "cursor-pointer rounded-full px-4 py-2 text-sm font-medium text-rose-950 transition-all duration-200 hover:bg-white/80 hover:text-fuchsia-700 hover:shadow-sm";

  const currentSection =
    NAV_ITEMS.find((item) => isActiveRoute(item.route))?.label || "Navigation";

  return (
    <MegaMenu className="border-b border-rose-100 bg-[linear-gradient(135deg,_rgba(255,247,251,0.96)_0%,_rgba(255,252,245,0.96)_48%,_rgba(243,252,245,0.96)_100%)] shadow-[0_14px_40px_-28px_rgba(190,24,93,0.45)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-screen-xl flex-wrap items-center justify-between gap-4 px-4 py-4 md:space-x-8">
        <Navbar.Brand
          className="group cursor-pointer rounded-2xl border border-white/70 bg-white/65 px-3 py-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/90"
          onClick={() => push(ROUTES.HOME)}
        >
          <img
            alt="Django + React logo"
            src="/dendrobium/orchid.png"
            className="mr-3 h-8 rounded-full ring-2 ring-rose-100 sm:h-10"
          />
          <span className="self-center whitespace-nowrap bg-gradient-to-r from-rose-700 via-fuchsia-700 to-emerald-700 bg-clip-text text-xl font-semibold tracking-tight text-transparent">
            Dendrobium Pangenome
          </span>
        </Navbar.Brand>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-rose-200 bg-white/75 px-3 py-1.5 text-xs font-medium text-rose-700 shadow-sm backdrop-blur md:inline-flex">
            Now Viewing:
            <span className="ml-1 font-semibold text-fuchsia-700">{currentSection}</span>
          </div>
          <Navbar.Toggle className="rounded-xl border border-rose-200 bg-white/80 text-rose-700 hover:bg-rose-50 focus:ring-rose-200" />
        </div>

        <Navbar.Collapse className="rounded-2xl border border-white/70 bg-white/55 px-2 py-2 shadow-sm backdrop-blur md:bg-transparent md:px-0 md:py-0 md:shadow-none">
          {NAV_ITEMS.slice(0, 7).map((item) => (
            <Navbar.Link
              key={item.route}
              onClick={() => push(item.route)}
              className={getNavLinkClass(isActiveRoute(item.route))}
            >
              {item.label}
            </Navbar.Link>
          ))}
          <Navbar.Link
            className="cursor-pointer rounded-full border border-fuchsia-200 bg-white/85 px-4 py-2 text-sm font-semibold text-fuchsia-700 shadow-[0_10px_24px_-18px_rgba(217,70,239,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-800"
            onClick={() => window.open("https://cosbi10.ee.ncku.edu.tw/dendrobium/SyntneyViewer/", "_blank")}
          >
            Synteny Portal
          </Navbar.Link>
          <Navbar.Link
            className="cursor-pointer rounded-full border border-fuchsia-200 bg-white/85 px-4 py-2 text-sm font-semibold text-fuchsia-700 shadow-[0_10px_24px_-18px_rgba(217,70,239,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-800"
            onClick={() => window.open("https://cosbi10.ee.ncku.edu.tw/dendrobium/Blast", "_blank")}
          >
            BLAST Portal
          </Navbar.Link>

          <Navbar.Link
            onClick={() => push(ROUTES.CONTACT)}
            className={getNavLinkClass(isActiveRoute(ROUTES.CONTACT))}
          >
            Contact
          </Navbar.Link>
        </Navbar.Collapse>
      </div>
    </MegaMenu>
  );
}
