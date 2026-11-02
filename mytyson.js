(function () {
  var STORAGE_KEY = 'mytyson_session_v1';
  var CUSTOM_KEY_PREFIX = 'mytyson_profile_custom_';
  var THEME_KEY = 'tyson_active_theme';
  var CHUNK_COUNT = 8;

  function setSharedCookie(name, value, days) {
    var expires = '';
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    var host = window.location.hostname;
    var domainAttr = '';
    if (host.endsWith('tysonmediagroup.org')) {
      domainAttr = '; domain=.tysonmediagroup.org';
    }
    document.cookie = name + '=' + encodeURIComponent(value || '') + expires + '; path=/' + domainAttr + '; SameSite=Lax';
  }

  function getCookie(name) {
    var escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
    var match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function readChunkedCookie(slug) {
    if (!slug) return null;
    var combined = '';
    for (var c = 0; c < 12; c++) {
      var part = getCookie('mytyson_p' + c + '_' + slug);
      if (!part) break;
      combined += part;
    }
    if (!combined) return null;
    try {
      return JSON.parse(combined);
    } catch (e) {
      return null;
    }
  }

  function ingestUrlSync() {
    var params = new URLSearchParams(window.location.search);
    var sso = params.get('mytyson_sso');
    if (sso) {
      try {
        var decoded = JSON.parse(atob(sso));
        if (decoded && decoded.slug) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(decoded));
        }
      } catch (e) {}
    }
    var customSync = params.get('mytyson_custom');
    if (customSync) {
      try {
        var cObj = JSON.parse(atob(customSync));
        if (cObj && cObj.slug) {
          var existing = {};
          try {
            var rawEx = localStorage.getItem(CUSTOM_KEY_PREFIX + cObj.slug);
            if (rawEx) existing = JSON.parse(rawEx);
          } catch (e) {}
          var merged = Object.assign({}, existing, cObj);
          if (!cObj.pfpUrl && existing.pfpUrl) {
            merged.pfpUrl = existing.pfpUrl;
          }
          if (!cObj.coverUrl && existing.coverUrl) {
            merged.coverUrl = existing.coverUrl;
          }
          localStorage.setItem(CUSTOM_KEY_PREFIX + cObj.slug, JSON.stringify(merged));
        }
      } catch (e) {}
    }
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || getCookie('mytyson_sso');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getCustomProfile(slug) {
    if (!slug) return null;
    var profile = null;
    try {
      var raw = localStorage.getItem(CUSTOM_KEY_PREFIX + slug);
      if (raw) profile = JSON.parse(raw);
    } catch (e) {}
    var chunked = readChunkedCookie(slug);
    if (!profile) {
      if (chunked) return chunked;
      try {
        var fallback = getCookie('mytyson_custom_' + slug);
        if (fallback) return JSON.parse(fallback);
      } catch (e) {}
      return null;
    }
    if (chunked) {
      if (!profile.pfpUrl && chunked.pfpUrl) profile.pfpUrl = chunked.pfpUrl;
      if (!profile.coverUrl && chunked.coverUrl) profile.coverUrl = chunked.coverUrl;
      if (!profile.displayName && chunked.displayName) profile.displayName = chunked.displayName;
    }
    return profile;
  }

  function getPageSlug() {
    var attr = document.body.getAttribute('data-profile-slug');
    if (attr && attr !== 'dynamic') return attr.toLowerCase();
    var pathParts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/');
    var pathSlug = pathParts[0];
    if (pathSlug && pathSlug !== '404' && pathSlug !== 'index.html' && pathSlug !== '404.html') {
      return pathSlug.toLowerCase();
    }
    return (attr || '').toLowerCase();
  }

  function applyCustomizations(customData) {
    var pageSlug = getPageSlug();
    if (!pageSlug) return;
    var custom = customData || getCustomProfile(pageSlug);
    if (!custom) return;

    var coverEl = document.getElementById('profileCoverPhoto');
    if (coverEl && custom.coverUrl && custom.coverUrl !== 'none') {
      coverEl.style.backgroundImage = 'linear-gradient(125deg, rgba(14, 16, 21, 0.35), rgba(5, 5, 8, 0.72)), url("' + custom.coverUrl + '")';
      coverEl.style.backgroundSize = 'cover';
      coverEl.style.backgroundPosition = 'center';
    }

    var avatarEl = document.getElementById('profileAvatarBox');
    if (avatarEl && custom.pfpUrl) {
      avatarEl.style.background = '#09090c';
      avatarEl.innerHTML = '<img class="avatar-img" src="' + custom.pfpUrl + '" alt="Profile Picture">';
    }

    var nameEl = document.getElementById('profileDisplayName');
    if (nameEl) {
      if (custom.showRealName === false) {
        nameEl.textContent = '@' + pageSlug;
      } else if (custom.displayName) {
        nameEl.textContent = custom.displayName;
      }
    }

    var bioEl = document.getElementById('profileBioText');
    if (bioEl && custom.bio) {
      bioEl.textContent = custom.bio;
    }

    var divEl = document.getElementById('profileDivisionText');
    if (divEl && custom.division) {
      divEl.textContent = custom.division;
    }

    var credName = document.getElementById('credDisplayName');
    if (credName && custom.displayName) {
      credName.textContent = custom.showRealName === false ? ('@' + pageSlug) : custom.displayName;
    }
  }

  function getDashboardBaseUrl() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8097';
    }
    return 'https://my.tysonmediagroup.org';
  }

  function getAuthBaseUrl() {
    var host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:8097/auth.html';
    }
    return 'https://auth.my.tysonmediagroup.org';
  }

  function updateLinksAndSession() {
    var session = getSession();
    var dashBase = getDashboardBaseUrl();
    var authBase = getAuthBaseUrl();
    var pageSlug = getPageSlug();

    var dashBtns = document.querySelectorAll('.js-dashboard-link');
    for (var i = 0; i < dashBtns.length; i++) {
      dashBtns[i].href = dashBase + (pageSlug ? '?user=' + encodeURIComponent(pageSlug) : '');
    }

    var authBtns = document.querySelectorAll('.js-auth-link');
    for (var j = 0; j < authBtns.length; j++) {
      var returnUrl = window.location.href.split('?')[0];
      if (session && session.slug) {
        authBtns[j].href = dashBase + '?user=' + encodeURIComponent(session.slug);
        var labelFull = authBtns[j].querySelector('.auth-btn-label-full');
        var labelShort = authBtns[j].querySelector('.auth-btn-label-short');
        if (labelFull) {
          labelFull.textContent = session.name || ('@' + session.slug);
          if (labelShort) labelShort.textContent = '@' + session.slug;
        } else {
          authBtns[j].textContent = 'Signed in: ' + (session.name || ('@' + session.slug));
        }
      } else {
        authBtns[j].href = authBase + '?redirect=' + encodeURIComponent(returnUrl) + '&app=' + encodeURIComponent('tmg');
      }
    }
  }

  function renderAccountData(acc) {
    if (!acc) return;
    var pageSlug = (acc.slug || '').toLowerCase();
    document.title = (acc.name || acc.slug) + ' (@' + acc.slug + ') | TYSON Media Group';

    var stageDomain = document.getElementById('stageProfileDomain');
    if (stageDomain) stageDomain.textContent = 'tysonmediagroup.org/' + pageSlug;

    var footerDomain = document.getElementById('footerDomain');
    if (footerDomain) footerDomain.textContent = 'tysonmediagroup.org/' + pageSlug;

    var nameEl = document.getElementById('profileDisplayName');
    if (nameEl) {
      nameEl.textContent = (acc.showRealName === false) ? ('@' + pageSlug) : (acc.name || acc.displayName || ('@' + pageSlug));
    }

    var isStaff = (acc.team === 'Y' || acc.team === true || acc.team === 'Official TYSON Account' || acc.team === 'Official Support Account');
    var formattedHandle = isStaff ? (pageSlug + '@tysonmediagroup.org') : ('@' + pageSlug);
    var teamLabel = isStaff ? 'TYSON Staff' : 'Community Member';

    var handleText = document.getElementById('profileHandleText');
    if (handleText) handleText.textContent = formattedHandle;

    var subText = document.getElementById('profileSubText');
    if (subText) subText.innerHTML = '<span class="brand-tmg-domain">tysonmediagroup.org/' + pageSlug + '</span> &bull; ' + teamLabel;

    var badgePill = document.getElementById('profileBadgePill');
    if (badgePill) {
      badgePill.textContent = acc.badge || 'Standard Member';
      badgePill.className = 'role-badge ' + (acc.badgeClass || 'badge-member');
    }

    var tysonBadge = document.getElementById('profileTysonBadge');
    if (tysonBadge) {
      tysonBadge.style.display = acc.hasTysonBadge ? 'inline-flex' : 'none';
    }

    var bioEl = document.getElementById('profileBioText');
    if (bioEl && acc.bio) bioEl.textContent = acc.bio;

    var divEl = document.getElementById('profileDivisionText');
    if (divEl && acc.division) divEl.textContent = acc.division;

    var avatarBox = document.getElementById('profileAvatarBox');
    if (avatarBox) {
      if (acc.pfpUrl) {
        avatarBox.style.background = '#09090c';
        avatarBox.innerHTML = '<img class="avatar-img" src="' + acc.pfpUrl + '" alt="' + (acc.name || pageSlug) + '">';
      } else {
        avatarBox.style.background = acc.avatarBg || 'linear-gradient(135deg, #18181b 0%, #09090b 100%)';
        avatarBox.textContent = acc.initials || pageSlug.slice(0, 2).toUpperCase();
      }
    }

    var coverEl = document.getElementById('profileCoverPhoto');
    if (coverEl && acc.coverBg) {
      coverEl.style.backgroundImage = acc.coverBg;
    }

    var infoHandle = document.getElementById('infoHandleText');
    if (infoHandle) infoHandle.textContent = formattedHandle;

    var infoTeam = document.getElementById('infoTeamText');
    if (infoTeam) infoTeam.textContent = teamLabel;

    var infoRole = document.getElementById('infoRoleText');
    if (infoRole) infoRole.textContent = acc.role || 'Member';

    var infoUrl = document.getElementById('infoUrlText');
    if (infoUrl) infoUrl.textContent = 'tysonmediagroup.org/' + pageSlug;

    var credUsername = document.getElementById('credUsernameText');
    if (credUsername) credUsername.textContent = formattedHandle;

    var credTeam = document.getElementById('credTeamText');
    if (credTeam) credTeam.textContent = teamLabel;

    var credDomain = document.getElementById('credDomainText');
    if (credDomain) credDomain.textContent = 'tysonmediagroup.org/' + pageSlug;

    var credName = document.getElementById('credDisplayName');
    if (credName) {
      credName.textContent = (acc.showRealName === false) ? ('@' + pageSlug) : (acc.name || acc.displayName || pageSlug);
    }
  }

  function fetchCloudProfile() {
    var pageSlug = getPageSlug();
    if (!pageSlug) return;
    var dashBase = getDashboardBaseUrl();

    // 1. Fetch dynamic account details from /api/accounts
    fetch(dashBase + '/api/accounts?_t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (accList) {
        if (Array.isArray(accList)) {
          var matched = accList.find(function (a) { return a && a.slug && a.slug.toLowerCase() === pageSlug; });
          if (matched) {
            renderAccountData(matched);
          }
        }
      })
      .catch(function () {});

    // 2. Fetch customizations from /api/profile
    fetch(dashBase + '/api/profile?slug=' + encodeURIComponent(pageSlug) + '&_t=' + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (cloudProfile) {
        if (cloudProfile && (cloudProfile.pfpUrl || cloudProfile.coverUrl || cloudProfile.displayName || cloudProfile.showRealName !== undefined)) {
          var existing = {};
          try {
            var raw = localStorage.getItem(CUSTOM_KEY_PREFIX + pageSlug);
            if (raw) existing = JSON.parse(raw);
          } catch (e) {}
          var merged = Object.assign({}, existing, cloudProfile);
          try {
            localStorage.setItem(CUSTOM_KEY_PREFIX + pageSlug, JSON.stringify(merged));
          } catch (e) {}
          applyCustomizations(merged);
        }
      })
      .catch(function () {});
  }

  function initBridgeIframe() {
    var pageSlug = document.body.getAttribute('data-profile-slug');
    if (!pageSlug) return;
    var dashBase = getDashboardBaseUrl();

    window.addEventListener('message', function (ev) {
      if (!ev.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'MYTYSON_BRIDGE_STATE' && ev.data.custom) {
        try {
          localStorage.setItem(CUSTOM_KEY_PREFIX + pageSlug, JSON.stringify(ev.data.custom));
        } catch (e) {}
        applyCustomizations(ev.data.custom);
      }
    });

    var iframe = document.createElement('iframe');
    iframe.src = dashBase + '/bridge.html?slug=' + encodeURIComponent(pageSlug);
    iframe.style.position = 'fixed';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);
  }

  function applyTheme(themeName) {
    var t = themeName || 'noir-aero';
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch (e) {}
    setSharedCookie(THEME_KEY, t, 365);
    var btns = document.querySelectorAll('[data-set-theme]');
    for (var i = 0; i < btns.length; i++) {
      if (btns[i].getAttribute('data-set-theme') === t) {
        btns[i].classList.add('active');
      } else {
        btns[i].classList.remove('active');
      }
    }
  }

  function initThemeDrawer() {
    var saved = 'noir-aero';
    try {
      saved = localStorage.getItem(THEME_KEY) || getCookie(THEME_KEY) || 'noir-aero';
    } catch (e) {}
    applyTheme(saved);

    var toggleBtn = document.getElementById('settings-toggle-btn');
    var drawer = document.getElementById('settings-drawer');
    var backdrop = document.getElementById('settings-drawer-backdrop');
    var closeBtn = document.getElementById('settings-close-btn');

    function openDrawer() {
      if (drawer) drawer.classList.add('open');
      if (backdrop) backdrop.classList.add('open');
    }
    function closeDrawer() {
      if (drawer) drawer.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
    }

    if (toggleBtn) toggleBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    var btns = document.querySelectorAll('[data-set-theme]');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', function () {
        applyTheme(this.getAttribute('data-set-theme'));
      });
    }

    initMobileCommandBar(openDrawer);
  }

  function clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setSharedCookie('mytyson_sso', '', -1);
  }

  function initMobileCommandBar(openDrawerFn) {
    if (!document.body) return;
    var bar = document.getElementById('tysonMobileCommandBar');
    if (!bar) {
      bar = document.createElement('nav');
      bar.className = 'tyson-command-bar';
      bar.id = 'tysonMobileCommandBar';
      bar.setAttribute('aria-label', 'Mobile Command Bar');
      bar.innerHTML =
        '<a href="https://auth.my.tysonmediagroup.org" class="btn btn-primary cmd-bar-btn" id="cmdBarAuthBtn">Sign In</a>' +
        '<a href="https://my.tysonmediagroup.org" class="btn cmd-bar-btn" id="cmdBarProfileBtn">Public Profile</a>' +
        '<button type="button" class="settings-toggle-btn cmd-bar-gear-btn" id="cmdBarSettingsBtn" title="Theme &amp; Appearance Settings" aria-label="Settings">' +
          '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="12" cy="12" r="3"></circle>' +
            '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>' +
          '</svg>' +
        '</button>';
      document.body.appendChild(bar);
    }

    var cmdGear = document.getElementById('cmdBarSettingsBtn');
    if (cmdGear) {
      cmdGear.addEventListener('click', function () {
        var drawer = document.getElementById('settings-drawer');
        var topGear = document.getElementById('settings-toggle-btn');
        if (drawer && typeof openDrawerFn === 'function') {
          openDrawerFn();
        } else if (topGear) {
          topGear.click();
        }
      });
    }

    var authBtn = document.getElementById('cmdBarAuthBtn');
    var profBtn = document.getElementById('cmdBarProfileBtn');
    var session = getSession();
    var authBase = getAuthBaseUrl();
    var dashBase = getDashboardBaseUrl();
    var pageSlug = getPageSlug();
    var returnUrl = window.location.href.split('?')[0];

    if (authBtn) {
      if (session && session.slug) {
        authBtn.textContent = 'Sign Out (' + session.slug + ')';
        authBtn.href = '#';
        authBtn.onclick = function (e) {
          e.preventDefault();
          clearSession();
          window.location.href = authBase + '?redirect=' + encodeURIComponent(returnUrl) + '&app=tmg';
        };
      } else {
        authBtn.textContent = 'Sign In';
        authBtn.href = authBase + '?redirect=' + encodeURIComponent(returnUrl) + '&app=tmg';
        authBtn.onclick = null;
      }
    }

    if (profBtn) {
      if (session && session.slug) {
        profBtn.href = '/' + encodeURIComponent(session.slug);
        profBtn.textContent = 'Public Profile';
      } else if (pageSlug) {
        profBtn.href = dashBase + '?user=' + encodeURIComponent(pageSlug);
        profBtn.textContent = 'myTYSON Profile';
      } else {
        profBtn.href = dashBase;
        profBtn.textContent = 'Public Profile';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    ingestUrlSync();
    applyCustomizations();
    updateLinksAndSession();
    initThemeDrawer();
    fetchCloudProfile();
    initBridgeIframe();
  });
})();
