/**
 * TYSON Websites Shared myTYSON Connector (/mytyson.js)
 * Loads unified /sdk/mytyson.js from my.tysonmediagroup.org and hydrates
 * navigation auth links, cross-domain SSO ?code= exchange, and R2/D1 profiles.
 */
(function () {
  "use strict";

  const DEFAULT_SDK_URL = "https://my.tysonmediagroup.org/sdk/mytyson.js";
  const RESERVED_STATIC_PAGES = new Set([
    "404", "404.html", "index", "index.html", "about", "about.html",
    "articles", "articles.html", "contact.html", "media", "media.html",
    "videos", "videos.html", "privacy", "privacy.html", "terms", "terms.html",
    "email-beta-invite.html"
  ]);

  function loadSdkScript() {
    if (window.MyTysonCore) return Promise.resolve(window.MyTysonCore);
    if (window.__mytysonSdkPromise) return window.__mytysonSdkPromise;

    window.__mytysonSdkPromise = new Promise((resolve, reject) => {
      const sdkUrl = typeof window.MYTYSON_SDK_URL === "string" ? window.MYTYSON_SDK_URL : DEFAULT_SDK_URL;
      const existing = document.querySelector('script[src*="/sdk/mytyson.js"]');
      if (existing) {
        existing.addEventListener("load", () => resolve(window.MyTysonCore));
        existing.addEventListener("error", reject);
        if (window.MyTysonCore) resolve(window.MyTysonCore);
        return;
      }

      const script = document.createElement("script");
      script.src = sdkUrl;
      script.async = true;
      script.onload = () => resolve(window.MyTysonCore);
      script.onerror = () => reject(new Error("Failed to load myTYSON SDK"));
      document.head.appendChild(script);
    });

    return window.__mytysonSdkPromise;
  }

  function cleanLegacySiteArtifacts() {
    try {
      localStorage.removeItem("mytyson_session_v1");
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("mytyson_profile_custom_")) {
          localStorage.removeItem(k);
        }
      });
    } catch (_) {}

    const past = "Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/";
    ["mytyson_sso", "mytyson_session"].forEach((name) => {
      document.cookie = name + "=; " + past;
      if (window.location.hostname.endsWith("tysonmediagroup.org")) {
        document.cookie = name + "=; " + past + "; Domain=.tysonmediagroup.org";
      }
    });
  }

  function getPageSlug() {
    const attr = document.body?.getAttribute("data-profile-slug");
    if (attr && attr !== "dynamic") return attr.toLowerCase();

    const parts = window.location.pathname.replace(/^\/+|\/+$/g, "").split("/");
    const first = (parts[0] || "").toLowerCase();
    if (first && !RESERVED_STATIC_PAGES.has(first)) {
      return first;
    }
    return "";
  }

  function updateAuthButtonLabel(el, fullLabel, shortLabel) {
    const labelFull = el.querySelector(".auth-btn-label-full");
    const labelShort = el.querySelector(".auth-btn-label-short");
    if (labelFull) {
      labelFull.textContent = fullLabel;
      if (labelShort) labelShort.textContent = shortLabel;
      return;
    }
    const spanChild = el.querySelector("span");
    if (spanChild) {
      spanChild.textContent = fullLabel;
      return;
    }
    if (!el.querySelector("img")) {
      el.textContent = fullLabel;
    }
  }

  function updateLinksAndSession(core, session) {
    const dashBase = core.getDashboardOrigin();
    const pageSlug = getPageSlug();
    const cleanReturn = window.location.href.split("?")[0];

    document.querySelectorAll(".js-dashboard-link").forEach((el) => {
      if (session && session.slug) {
        el.href = dashBase;
      } else if (pageSlug) {
        el.href = dashBase + "?user=" + encodeURIComponent(pageSlug);
      } else {
        el.href = dashBase;
      }
    });

    document.querySelectorAll(".js-auth-link").forEach((el) => {
      if (session && session.slug) {
        el.href = dashBase;
        const displayName = (session.showRealName !== false && session.name) ? session.name : ("@" + session.slug);
        updateAuthButtonLabel(el, displayName, "@" + session.slug);
      } else {
        el.href = core.buildAuthUrl("login", cleanReturn);
        updateAuthButtonLabel(el, "myTYSON Sign In", "Sign In");
      }
    });
  }

  function renderProfilePage(core, profile) {
    if (!profile || !profile.slug) return;
    const pageSlug = profile.slug.toLowerCase();
    const displayName = profile.showRealName === false ? ("@" + pageSlug) : (profile.name || ("@" + pageSlug));
    const isStaff = core.isStaffAccount(profile);
    const formattedHandle = isStaff ? (pageSlug + "@tysonmediagroup.org") : ("@" + pageSlug);
    const teamLabel = isStaff ? "TYSON Staff" : "Community Member";

    document.title = displayName + " (@" + pageSlug + ") | TYSON Media Group";

    const setText = (id, value) => {
      const el = document.getElementById(id);
      if (el && value !== undefined && value !== null) el.textContent = value;
    };

    setText("stageProfileDomain", "tysonmediagroup.org/" + pageSlug);
    setText("footerDomain", "tysonmediagroup.org/" + pageSlug);
    setText("profileDisplayName", displayName);
    setText("profileHandleText", formattedHandle);
    setText("profileBioText", profile.bio || "");
    setText("profileDivisionText", profile.division || "TYSON Media Group");
    setText("infoHandleText", formattedHandle);
    setText("infoTeamText", teamLabel);
    setText("infoRoleText", profile.role || "Member");
    setText("infoUrlText", "tysonmediagroup.org/" + pageSlug);
    setText("credUsernameText", formattedHandle);
    setText("credTeamText", teamLabel);
    setText("credDomainText", "tysonmediagroup.org/" + pageSlug);
    setText("credDisplayName", displayName);

    const subText = document.getElementById("profileSubText");
    if (subText) {
      subText.innerHTML =
        '<span class="brand-tmg-domain">tysonmediagroup.org/' +
        core.escapeHtml(pageSlug) +
        "</span> &bull; " +
        core.escapeHtml(teamLabel);
    }

    const badgePill = document.getElementById("profileBadgePill");
    if (badgePill) {
      badgePill.textContent = profile.badge || "Standard Member";
      badgePill.className = "role-badge " + (profile.badgeClass || "badge-member");
    }

    const tysonBadge = document.getElementById("profileTysonBadge");
    if (tysonBadge) {
      tysonBadge.style.display = (profile.hasTysonBadge || isStaff) ? "inline-flex" : "none";
    }

    const coverEl = document.getElementById("profileCoverPhoto");
    const coverUrl = core.resolveMediaUrl(profile.coverUrl || "");
    if (coverEl && coverUrl) {
      coverEl.style.backgroundImage =
        'linear-gradient(125deg, rgba(14, 16, 21, 0.35), rgba(5, 5, 8, 0.72)), url("' + encodeURI(coverUrl) + '")';
      coverEl.style.backgroundSize = "cover";
      coverEl.style.backgroundPosition = "center";
    }

    const avatarBox = document.getElementById("profileAvatarBox");
    const avatarUrl = core.resolveMediaUrl(profile.avatarUrl || profile.pfpUrl || "");
    if (avatarBox) {
      if (avatarUrl) {
        avatarBox.style.background = "#09090c";
        avatarBox.innerHTML = "";
        const img = document.createElement("img");
        img.className = "avatar-img";
        img.src = avatarUrl;
        img.alt = displayName;
        avatarBox.appendChild(img);
      } else {
        avatarBox.style.background = "linear-gradient(135deg, #18181b 0%, #09090b 100%)";
        avatarBox.textContent = profile.initials || core.getInitials(profile.name, pageSlug);
      }
    }
  }

  function initLegacyCommandBar(core, session) {
    // Only render legacy floating command bar on profile/legacy pages that have data-profile-slug or #settings-drawer.
    // The flagship home page already provides its own integrated responsive nav & theme drawer.
    const isProfileOrDrawerPage = Boolean(document.body?.hasAttribute("data-profile-slug") || document.getElementById("settings-drawer"));
    if (!isProfileOrDrawerPage || !document.body) return;

    let bar = document.getElementById("tysonMobileCommandBar");
    if (!bar) {
      bar = document.createElement("nav");
      bar.className = "tyson-command-bar";
      bar.id = "tysonMobileCommandBar";
      bar.setAttribute("aria-label", "Mobile Command Bar");
      bar.innerHTML =
        '<a href="https://auth.my.tysonmediagroup.org" class="btn btn-primary cmd-bar-btn" id="cmdBarAuthBtn">Sign In</a>' +
        '<a href="https://my.tysonmediagroup.org" class="btn cmd-bar-btn" id="cmdBarProfileBtn">Public Profile</a>' +
        '<button type="button" class="settings-toggle-btn cmd-bar-gear-btn" id="cmdBarSettingsBtn" title="Theme & Appearance Settings" aria-label="Settings">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="3"></circle>' +
            '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
          "</svg>" +
        "</button>";
      document.body.appendChild(bar);
    }

    const cmdGear = document.getElementById("cmdBarSettingsBtn");
    if (cmdGear) {
      cmdGear.addEventListener("click", () => {
        const drawer = document.getElementById("settings-drawer");
        const backdrop = document.getElementById("settings-drawer-backdrop");
        if (drawer) drawer.classList.add("open");
        if (backdrop) backdrop.classList.add("open");
      });
    }

    const authBtn = document.getElementById("cmdBarAuthBtn");
    const profBtn = document.getElementById("cmdBarProfileBtn");
    const dashBase = core.getDashboardOrigin();
    const pageSlug = getPageSlug();
    const returnUrl = window.location.href.split("?")[0];

    if (authBtn) {
      if (session && session.slug) {
        authBtn.textContent = "Sign Out (" + session.slug + ")";
        authBtn.href = "#";
        authBtn.onclick = async (e) => {
          e.preventDefault();
          await core.logout();
          window.location.href = core.buildAuthUrl("login", returnUrl);
        };
      } else {
        authBtn.textContent = "Sign In";
        authBtn.href = core.buildAuthUrl("login", returnUrl);
        authBtn.onclick = null;
      }
    }

    if (profBtn) {
      if (session && session.slug) {
        profBtn.href = "/" + encodeURIComponent(session.slug);
        profBtn.textContent = "Public Profile";
      } else if (pageSlug) {
        profBtn.href = dashBase + "?user=" + encodeURIComponent(pageSlug);
        profBtn.textContent = "myTYSON Profile";
      } else {
        profBtn.href = dashBase;
        profBtn.textContent = "myTYSON Dashboard";
      }
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    cleanLegacySiteArtifacts();

    let core;
    try {
      core = await loadSdkScript();
    } catch (err) {
      console.warn("[myTYSON] SDK load failed:", err);
      return;
    }

    const isProfilePage = Boolean(document.body?.hasAttribute("data-profile-slug") || document.getElementById("profileAvatarBox"));
    if (isProfilePage || document.getElementById("settings-drawer")) {
      core.initThemeDrawer();
    }

    const session = await core.ready();
    updateLinksAndSession(core, session);
    initLegacyCommandBar(core, session);

    window.addEventListener("mytyson:session", (ev) => {
      updateLinksAndSession(core, ev.detail?.session || null);
    });

    const pageSlug = getPageSlug();
    if (pageSlug && (document.body?.hasAttribute("data-profile-slug") || document.getElementById("profileAvatarBox"))) {
      const profile = await core.getProfile(pageSlug);
      if (profile) {
        renderProfilePage(core, profile);
      }
    }
  });
})();
