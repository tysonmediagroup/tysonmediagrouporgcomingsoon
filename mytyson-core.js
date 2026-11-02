(function (window) {
  var STORAGE_KEY = 'mytyson_session_v1';
  var CUSTOM_KEY_PREFIX = 'mytyson_profile_custom_';
  var CUSTOM_ACCOUNTS_KEY = 'mytyson_custom_accounts_v1';
  var THEME_KEY = 'tyson_active_theme';
  var CHUNK_COUNT = 8;
  var CHUNK_SIZE = 2800;

  // Central Google OAuth Client ID for myTYSON SSO (can also be set via env.GOOGLE_CLIENT_ID on Cloudflare)
  var GOOGLE_CLIENT_ID = window.MYTYSON_GOOGLE_CLIENT_ID || '1054168096128-2er1dlrrkeqphr2bu8vpsa4v1rd99reg.apps.googleusercontent.com';

  // Pure-JS synchronous SHA-256 so client-side authenticate() never stores plaintext passwords in source code
  function sha256Hex(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = sha256Hex.h = sha256Hex.h || [];
    var k = sha256Hex.k = sha256Hex.k || [];
    var primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;
    for (j = 0; j < words[lengthProperty]; ) {
      var w = words.slice(j, (j += 16));
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var i2 = i + j;
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        var temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        var b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  function utf8ToAscii(str) {
    return unescape(encodeURIComponent(str || ''));
  }

  function hashPasswordSync(password, slug) {
    var cleanSlug = (slug || '').toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    var raw = 'mytyson_salt_v1:' + cleanSlug + ':' + (password || '').trim();
    return sha256Hex(utf8ToAscii(raw));
  }

  function isStaffMember(accOrTeam) {
    var t = typeof accOrTeam === 'object' && accOrTeam !== null ? accOrTeam.team : accOrTeam;
    return t === 'Y' || t === true || t === 'Official TYSON Account' || t === 'Official Support Account';
  }

  // Only TYSON Staff (team === 'Y') receive @tysonmediagroup.org handles; standard users use their clean slug
  function formatAccountUsername(slug, isStaff) {
    var clean = (slug || '').toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    if (!clean) return '';
    return isStaff ? (clean + '@tysonmediagroup.org') : clean;
  }

  function formatDisplayHandle(accOrSlug) {
    if (!accOrSlug) return '';
    if (typeof accOrSlug === 'string') {
      var found = findAccount(accOrSlug);
      if (found) accOrSlug = found;
      else return accOrSlug.indexOf('@') !== -1 ? accOrSlug : ('@' + accOrSlug);
    }
    var clean = (accOrSlug.slug || accOrSlug.username || '').toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    if (isStaffMember(accOrSlug)) {
      return clean + '@tysonmediagroup.org';
    }
    return '@' + clean;
  }

  var DEFAULT_ACCOUNTS = [
    {
      name: 'Stephen French',
      username: 'flame@tysonmediagroup.org',
      slug: 'flame',
      aliases: ['flame@tysonmediagroup.org', 'flame'],
      passwordHashes: ['b5721c15816b6a87b238a2565d38772814857d050a262d0186680214b3c773c5'],
      team: 'Y',
      badge: 'TYSON Team',
      badgeClass: 'badge-team',
      hasTysonBadge: true,
      initials: 'SF',
      avatarBg: 'linear-gradient(135deg, #991b1b 0%, #450a0a 100%)',
      coverBg: 'linear-gradient(125deg, #1a0505 0%, #3b0a0a 45%, #09090b 100%)',
      defaultCoverUrl: '/assets/tyson-t5s-login-backdrop.jpg',
      role: 'TYSON Team Member',
      division: 'TYSON Atlantis / Creative Direction',
      bio: 'Official myTYSON profile for Stephen French.'
    },
    {
      name: 'Tyler Custine',
      username: 't@tysonmediagroup.org',
      slug: 't',
      aliases: ['t@tysonmediagroup.org', 't', 'ty', 'ty@tysonmediagroup.org'],
      passwordHashes: ['3745b1327b96c9c6ede767ee79e2b8907c3fdba31fb6c8fb6bb8e76cb0525f92'],
      team: 'Y',
      badge: 'TYSON Team',
      badgeClass: 'badge-team',
      hasTysonBadge: true,
      initials: 'TC',
      avatarBg: 'linear-gradient(135deg, #b91c1c 0%, #111827 100%)',
      coverBg: 'linear-gradient(125deg, #2a0808 0%, #111827 55%, #09090b 100%)',
      defaultCoverUrl: '/assets/atlantis-sunset.jpg',
      role: 'Founder & Executive Lead',
      division: 'TYSON Media Group / Core Systems',
      bio: 'Official myTYSON profile for Tyler Custine.',
      isPowerAdmin: true
    },
    {
      name: 'TYSON Media Group',
      username: 'tyson@tysonmediagroup.org',
      loginId: 'tyson',
      slug: 'tyson',
      aliases: ['tyson', 'tyson@tysonmediagroup.org'],
      passwordHashes: ['b6cbc904b5abaf19a634bd6acc4ed9093f8034366a04f8356c0f60ff3cbd966d'],
      team: 'Y',
      badge: 'Official TYSON Account',
      badgeClass: 'badge-official',
      hasTysonBadge: true,
      initials: 'TMG',
      avatarBg: 'linear-gradient(135deg, #d97706 0%, #451a03 100%)',
      coverBg: 'linear-gradient(125deg, #2e1905 0%, #18181b 55%, #09090b 100%)',
      defaultCoverUrl: '/assets/tyson-t5s-login-backdrop.jpg',
      role: 'Primary Organization Account',
      division: 'TYSON Media Group',
      bio: 'Official organization profile for TYSON Media Group.',
      isPowerAdmin: true
    },
    {
      name: 'Ash French',
      username: 'a@tysonmediagroup.org',
      slug: 'a',
      aliases: ['a@tysonmediagroup.org', 'a', 'ash', 'ash@tysonmediagroup.org', 'ashfrench'],
      passwordHashes: ['7f33322277113c6591fa920fa06c0f5a3c4e4a33715aa0c9fd24c6251f591d19'],
      team: 'Y',
      badge: 'TYSON Team',
      badgeClass: 'badge-team',
      hasTysonBadge: true,
      initials: 'AF',
      avatarBg: 'linear-gradient(135deg, #7f1d1d 0%, #1e1b4b 100%)',
      coverBg: 'linear-gradient(125deg, #1f091d 0%, #111827 55%, #09090b 100%)',
      defaultCoverUrl: '/assets/photograph.jpg',
      role: 'TYSON Team Member',
      division: 'TYSON Media Group',
      bio: 'Official myTYSON profile for Ash French.',
      isPowerAdmin: true
    },
    {
      name: 'Triston Rinebarger',
      username: 'rpm@tysonmediagroup.org',
      slug: 'rpm',
      aliases: ['rpm@tysonmediagroup.org', 'rpm'],
      passwordHashes: [
        'c3490c62ef1680ccd128e0d57655b85fbb33683ee91f5f4dc3d5ef6a9bb78c17',
        '4f54664f678ba0d7b2069f8853b1998e5c23789fd5d34102f65872935a65cdb3'
      ],
      team: 'Y',
      badge: 'TYSON Team',
      badgeClass: 'badge-team',
      hasTysonBadge: true,
      initials: 'TR',
      avatarBg: 'linear-gradient(135deg, #991b1b 0%, #1f2937 100%)',
      coverBg: 'linear-gradient(125deg, #260b0b 0%, #18181b 55%, #09090b 100%)',
      defaultCoverUrl: '/assets/atlantisplayer_nightgasstation1.jpg',
      role: 'TYSON Team Member',
      division: 'TYSON RPM / Operations',
      bio: 'Official myTYSON profile for Triston Rinebarger.'
    },
    {
      name: 'TYSON Support',
      username: 'contact@tysonmediagroup.org',
      slug: 'contact',
      aliases: ['contact@tysonmediagroup.org', 'contact'],
      passwordHashes: ['5b9b9f6cc4a8e3a8168525e5d875cbeeb66be6a21ac823e459257058887a217c'],
      team: 'Y',
      badge: 'Official Support Account',
      badgeClass: 'badge-support',
      hasTysonBadge: true,
      initials: 'TS',
      avatarBg: 'linear-gradient(135deg, #0284c7 0%, #0c4a6e 100%)',
      coverBg: 'linear-gradient(125deg, #082032 0%, #111827 55%, #09090b 100%)',
      defaultCoverUrl: '/assets/tyson-t5s-login-backdrop.jpg',
      role: 'Official Support Channel',
      division: 'TYSON Support & Communications',
      bio: 'Official myTYSON support and contact account.'
    },
    {
      name: 'Jake Gantt',
      username: 'j.gantt',
      slug: 'j.gantt',
      aliases: ['j.gantt'],
      passwordHashes: ['a4428c9f3b6e73d8f9c2244c510cb1c88ec314bcbbecacf2580d538791cfa0b7'],
      team: 'N',
      badge: 'Standard Member',
      badgeClass: 'badge-member',
      hasTysonBadge: false,
      initials: 'JG',
      avatarBg: 'linear-gradient(135deg, #27272a 0%, #09090b 100%)',
      coverBg: 'linear-gradient(125deg, #18181b 0%, #09090b 65%, #050505 100%)',
      defaultCoverUrl: '',
      role: 'Registered Member',
      division: 'Independent / External',
      bio: 'Registered myTYSON account for Jake Gantt.'
    },
    {
      name: 'Eythn Cullia',
      firstName: '',
      lastName: '',
      showRealName: false,
      username: 'eythn@tysonmediagroup.org',
      slug: 'eythn',
      aliases: ['eythn@tysonmediagroup.org', 'eythn'],
      passwordHashes: ['020eb6fb068b8c6400bb2a26428cc67157e7f32c5d985cad45513a5ab984d175'],
      team: 'Y',
      badge: 'TYSON Team',
      badgeClass: 'badge-team',
      hasTysonBadge: true,
      initials: 'EC',
      avatarBg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
      coverBg: 'linear-gradient(125deg, #18181b 0%, #09090b 65%, #050505 100%)',
      defaultCoverUrl: '',
      role: 'Marketing Coordinator',
      division: 'TYSON Media Group',
      bio: 'myTYSON profile for Eythn Cullia.'
    },
    {
      name: 'Jason May',
      firstName: 'Jason',
      lastName: 'May',
      showRealName: true,
      username: 'jmay',
      slug: 'jmay',
      aliases: ['jmay', 'jmay@tysonmediagroup.org'],
      passwordHashes: ['93ac3fb9fab415b2a9e437e0816115b579efebe39259bf86118558538fb52fda'],
      team: 'N',
      badge: 'Standard Member',
      badgeClass: 'badge-member',
      hasTysonBadge: false,
      initials: 'JM',
      avatarBg: 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
      coverBg: 'linear-gradient(125deg, #18181b 0%, #09090b 65%, #050505 100%)',
      defaultCoverUrl: '',
      role: 'Registered Member',
      division: 'Community Member',
      bio: 'myTYSON profile for Jason May.'
    }
  ];

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

  function getSharedCookie(name) {
    var escaped = name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1');
    var match = document.cookie.match(new RegExp('(?:^|; )' + escaped + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function writeChunkedCookie(slug, rawJson) {
    if (!slug) return;
    var host = window.location.hostname;
    // Skip chunked cookies on localhost to prevent HTTP 431 Request Header Fields Too Large on local dev servers
    if (host === 'localhost' || host === '127.0.0.1') return;
    for (var c = 0; c < 12; c++) {
      if (c < CHUNK_COUNT && rawJson) {
        var part = rawJson.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
        if (part) {
          setSharedCookie('mytyson_p' + c + '_' + slug, part, 365);
          continue;
        }
      }
      setSharedCookie('mytyson_p' + c + '_' + slug, '', -1);
    }
  }

  function readChunkedCookie(slug) {
    if (!slug) return null;
    var combined = '';
    for (var c = 0; c < 12; c++) {
      var part = getSharedCookie('mytyson_p' + c + '_' + slug);
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

  function getCloudApiBase() {
    var h = window.location.hostname;
    var port = window.location.port;
    if (h === 'localhost' || h === '127.0.0.1') {
      return (port === '8097' || !port) ? '' : 'http://localhost:8097';
    }
    return 'https://my.tysonmediagroup.org';
  }

  function getAuthHeader() {
    var s = getSession();
    if (!s) return {};
    return { Authorization: 'Bearer ' + encodeSsoToken(s) };
  }

  function getCustomAccounts() {
    try {
      var raw = localStorage.getItem(CUSTOM_ACCOUNTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomAccounts(accounts) {
    try {
      localStorage.setItem(CUSTOM_ACCOUNTS_KEY, JSON.stringify(accounts || []));
    } catch (e) {}
  }

  function normalizeAccountObject(acc) {
    if (!acc) return acc;
    var copy = Object.assign({}, acc);
    var cleanSlug = (copy.slug || copy.username || '').toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    var isStaff = isStaffMember(copy);
    copy.slug = cleanSlug;
    copy.team = isStaff ? 'Y' : 'N';
    copy.username = formatAccountUsername(cleanSlug, isStaff);
    return copy;
  }

  function getAllAccounts() {
    var custom = getCustomAccounts();
    var map = {};
    for (var i = 0; i < DEFAULT_ACCOUNTS.length; i++) {
      var d = DEFAULT_ACCOUNTS[i];
      map[d.slug.toLowerCase()] = normalizeAccountObject(d);
    }
    for (var j = 0; j < custom.length; j++) {
      var c = custom[j];
      if (c && c.slug) {
        var k = c.slug.toLowerCase();
        map[k] = normalizeAccountObject(Object.assign({}, map[k] || {}, c));
      }
    }
    return Object.values(map);
  }

  function findAccount(identifier) {
    if (!identifier) return null;
    var clean = identifier.trim().toLowerCase();
    var stripped = clean.replace(/@tysonmediagroup\.org$/i, '');
    var all = getAllAccounts();
    for (var i = 0; i < all.length; i++) {
      var acc = all[i];
      if (acc.slug && acc.slug.toLowerCase() === stripped) return acc;
      if (acc.username && acc.username.toLowerCase() === clean) return acc;
      if (acc.aliases && acc.aliases.some(function (a) { return (a || '').toLowerCase() === clean; })) return acc;
    }
    return null;
  }

  function isPowerAdmin(sessionOrSlug) {
    var s = sessionOrSlug;
    if (typeof s === 'object' && s !== null) s = s.slug || s.username;
    s = (s || '').trim().toLowerCase().replace(/@tysonmediagroup\.org$/i, '');
    return s === 'tyson' || s === 't' || s === 'ash' || s === 'a';
  }

  function createAccount(data, callback) {
    var rawSlug = (data.slug || data.username || '').trim().toLowerCase();
    var cleanSlug = rawSlug.replace(/@tysonmediagroup\.org$/i, '').trim();

    if (!data.isPowerAdmin) {
      if (cleanSlug.length < 3) {
        var errRes = { ok: false, error: 'Username must be at least 3 characters long.' };
        if (typeof callback === 'function') callback(errRes);
        return errRes;
      }
      if (!/^[a-z0-9._-]+$/i.test(cleanSlug)) {
        var errFmt = { ok: false, error: 'Username may only contain letters, numbers, periods, and hyphens.' };
        if (typeof callback === 'function') callback(errFmt);
        return errFmt;
      }
    }

    if (findAccount(cleanSlug)) {
      var errExists = { ok: false, error: 'Account with username "' + cleanSlug + '" already exists.' };
      if (typeof callback === 'function') callback(errExists);
      return errExists;
    }

    var firstName = (data.firstName || '').trim();
    var lastName = (data.lastName || '').trim();
    var dName = (data.name || [firstName, lastName].filter(Boolean).join(' ') || cleanSlug).trim();
    var initials = ((firstName[0] || '') + (lastName[0] || (cleanSlug[0] || ''))).toUpperCase() || 'TM';
    var isTeam = (data.team === 'Y' || data.team === true || data.isTeam === true);
    var plainPassword = data.password || 'password123';
    var pwHash = hashPasswordSync(plainPassword, cleanSlug);

    // Only TYSON Staff get @tysonmediagroup.org; non-staff get clean slug
    var formattedUsername = formatAccountUsername(cleanSlug, isTeam);

    var newAcc = {
      name: dName,
      firstName: firstName,
      lastName: lastName,
      showRealName: data.showRealName !== false,
      username: formattedUsername,
      slug: cleanSlug,
      aliases: isTeam ? [cleanSlug + '@tysonmediagroup.org', cleanSlug] : [cleanSlug],
      passwordHashes: [pwHash],
      team: isTeam ? 'Y' : 'N',
      badge: data.badge || (isTeam ? 'TYSON Team' : 'Standard Member'),
      badgeClass: data.badgeClass || (isTeam ? 'badge-team' : 'badge-member'),
      hasTysonBadge: data.hasTysonBadge !== undefined ? !!data.hasTysonBadge : isTeam,
      initials: initials,
      avatarBg: data.avatarBg || 'linear-gradient(135deg, #18181b 0%, #09090b 100%)',
      coverBg: data.coverBg || 'linear-gradient(125deg, #18181b 0%, #09090b 65%, #050505 100%)',
      defaultCoverUrl: data.defaultCoverUrl || '',
      role: data.role || (isTeam ? 'TYSON Team Member' : 'Registered Member'),
      division: data.division || (isTeam ? 'TYSON Media Group' : 'Community Member'),
      bio: data.bio || ('myTYSON profile for ' + dName + '.'),
      pfpUrl: data.pfpUrl || '',
      isDynamic: true,
      isPowerAdmin: !!data.isPowerAdmin,
      createdAt: Date.now()
    };

    var custom = getCustomAccounts();
    custom.push(newAcc);
    saveCustomAccounts(custom);

    saveCustomProfile(cleanSlug, {
      displayName: dName,
      firstName: firstName,
      lastName: lastName,
      showRealName: newAcc.showRealName,
      division: newAcc.division,
      bio: newAcc.bio,
      pfpUrl: newAcc.pfpUrl,
      coverUrl: ''
    });

    var apiBase = getCloudApiBase();
    var payloadToSend = Object.assign({}, newAcc, { password: plainPassword });
    fetch(apiBase + '/api/accounts', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body: JSON.stringify(payloadToSend)
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().then(function (err) {
            throw new Error((err && err.error) || ('Server returned HTTP ' + r.status));
          });
        }
        return r.json();
      })
      .then(function (serverRes) {
        var accOut = (serverRes && serverRes.account) ? normalizeAccountObject(serverRes.account) : newAcc;
        var res = { ok: true, account: accOut };
        if (typeof callback === 'function') callback(res);
      })
      .catch(function (e) {
        var res = { ok: true, account: newAcc, syncNotice: e.message };
        if (typeof callback === 'function') callback(res);
      });

    return { ok: true, account: newAcc };
  }

  function updateAccount(slug, updates, callback) {
    if (!slug) return;
    var clean = slug.toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    var custom = getCustomAccounts();
    var idx = custom.findIndex(function (a) { return a.slug.toLowerCase() === clean; });
    var target = null;

    var processedUpdates = Object.assign({}, updates);
    if (processedUpdates.password) {
      processedUpdates.passwordHashes = [hashPasswordSync(processedUpdates.password, clean)];
    }

    if (idx >= 0) {
      custom[idx] = normalizeAccountObject(Object.assign({}, custom[idx], processedUpdates));
      delete custom[idx].password;
      target = custom[idx];
      saveCustomAccounts(custom);
    } else {
      var d = DEFAULT_ACCOUNTS.find(function (a) { return a.slug.toLowerCase() === clean; });
      if (d) {
        target = normalizeAccountObject(Object.assign({}, d, processedUpdates, { isDynamic: true }));
        delete target.password;
        custom.push(target);
        saveCustomAccounts(custom);
      }
    }

    if (target) {
      var apiBase = getCloudApiBase();
      fetch(apiBase + '/api/accounts', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
        body: JSON.stringify(Object.assign({}, target, updates.password ? { password: updates.password } : {}))
      }).catch(function () {});
    }

    var res = { ok: !!target, account: target };
    if (typeof callback === 'function') callback(res);
    return res;
  }

  function deleteAccount(slug, callback) {
    if (!slug) return;
    var clean = slug.toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    if (clean === 'tyson' || clean === 't' || clean === 'ash' || clean === 'a') {
      var errRes = { ok: false, error: 'Cannot delete primary root admin account.' };
      if (typeof callback === 'function') callback(errRes);
      return errRes;
    }

    var custom = getCustomAccounts();
    custom = custom.filter(function (a) { return a.slug.toLowerCase() !== clean; });
    saveCustomAccounts(custom);

    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/accounts?slug=' + encodeURIComponent(clean), {
      method: 'DELETE',
      headers: getAuthHeader()
    }).catch(function () {});

    resetCustomProfile(clean);

    var res = { ok: true };
    if (typeof callback === 'function') callback(res);
    return res;
  }

  function syncAccountsFromCloud(callback) {
    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/accounts?_t=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (cloudAccounts) {
        if (Array.isArray(cloudAccounts)) {
          var local = getCustomAccounts();
          var map = {};
          for (var i = 0; i < local.length; i++) {
            if (local[i] && local[i].slug) map[local[i].slug.toLowerCase()] = local[i];
          }
          for (var j = 0; j < cloudAccounts.length; j++) {
            var ca = cloudAccounts[j];
            if (ca && ca.slug) {
              var k = ca.slug.toLowerCase();
              var prev = map[k] || {};
              // Preserve local passwordHashes if server sanitized them
              var merged = normalizeAccountObject(Object.assign({}, prev, ca));
              if (!merged.passwordHashes && prev.passwordHashes) {
                merged.passwordHashes = prev.passwordHashes;
              }
              map[k] = merged;
            }
          }
          saveCustomAccounts(Object.values(map));
        }
        if (typeof callback === 'function') callback(getAllAccounts());
      })
      .catch(function () {
        if (typeof callback === 'function') callback(getAllAccounts());
      });
  }

  function authenticate(identifier, password, asyncCallback) {
    var acc = findAccount(identifier);
    var pass = (password || '').trim();

    if (acc && pass) {
      var candidateHash = hashPasswordSync(pass, acc.slug);
      var validHash = Array.isArray(acc.passwordHashes) && acc.passwordHashes.indexOf(candidateHash) !== -1;
      var validLegacy = (acc.password && acc.password === pass) || (acc.altPasswords && acc.altPasswords.indexOf(pass) !== -1);
      if (validHash || validLegacy) {
        var localSession = createSessionForAccount(acc);
        if (typeof asyncCallback === 'function') asyncCallback(localSession);
        return localSession;
      }
    }

    // If an asyncCallback is provided, also verify against the Cloudflare D1 / Edge Auth endpoint
    if (typeof asyncCallback === 'function') {
      var apiBase = getCloudApiBase();
      fetch(apiBase + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: identifier, password: pass })
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res && res.ok && res.session) {
            if (res.account) {
              var custom = getCustomAccounts();
              var idx = custom.findIndex(function (a) { return a.slug.toLowerCase() === res.account.slug.toLowerCase(); });
              if (idx >= 0) custom[idx] = Object.assign({}, custom[idx], res.account);
              else custom.push(res.account);
              saveCustomAccounts(custom);
            }
            var savedSess = saveSessionObject(res.session);
            asyncCallback(savedSess);
          } else {
            asyncCallback(null, (res && res.error) || 'Invalid myTYSON username or password.');
          }
        })
        .catch(function () {
          asyncCallback(null, 'Invalid myTYSON username or password.');
        });
    }

    return null;
  }

  function saveSessionObject(session) {
    if (!session) return null;
    var isStaff = isStaffMember(session);
    var cleanSlug = (session.slug || session.username || '').toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    var normalized = Object.assign({}, session, {
      slug: cleanSlug,
      username: formatAccountUsername(cleanSlug, isStaff),
      team: isStaff ? 'Y' : 'N'
    });
    var raw = JSON.stringify(normalized);
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch (e) {}
    setSharedCookie('mytyson_sso', raw, 30);
    return normalized;
  }

  function createSessionForAccount(acc, extraSessionProps) {
    var isStaff = isStaffMember(acc);
    var cleanSlug = (acc.slug || acc.username || '').toLowerCase().replace(/@tysonmediagroup\.org$/i, '').trim();
    var session = Object.assign({
      name: acc.name,
      username: formatAccountUsername(cleanSlug, isStaff),
      slug: cleanSlug,
      team: isStaff ? 'Y' : 'N',
      badge: acc.badge || (isStaff ? 'TYSON Team' : 'Standard Member'),
      hasTysonBadge: acc.hasTysonBadge !== undefined ? !!acc.hasTysonBadge : isStaff,
      googleLinked: !!(acc.googleLinked || acc.googleSub || acc.googleEmail),
      googleEmail: acc.googleEmail || '',
      ts: Date.now()
    }, extraSessionProps || {});
    return saveSessionObject(session);
  }

  // --- Centralized Google SSO Client SDK ---

  function authenticateWithGoogle(credentialOrOptions, callback) {
    var payload = { mode: 'signin' };
    if (typeof credentialOrOptions === 'string') {
      payload.credential = credentialOrOptions;
    } else if (credentialOrOptions && typeof credentialOrOptions === 'object') {
      payload = Object.assign(payload, credentialOrOptions);
    }

    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/auth/google', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          if (typeof callback === 'function') callback({ ok: false, error: (res && res.error) || 'Google sign-in failed.' });
          return;
        }
        if (res.status === 'AUTHENTICATED' && res.session) {
          if (res.account) {
            var custom = getCustomAccounts();
            var idx = custom.findIndex(function (a) { return a.slug.toLowerCase() === res.account.slug.toLowerCase(); });
            if (idx >= 0) custom[idx] = Object.assign({}, custom[idx], res.account);
            else custom.push(res.account);
            saveCustomAccounts(custom);
          }
          var session = saveSessionObject(res.session);
          if (typeof callback === 'function') {
            callback({ ok: true, status: 'AUTHENTICATED', account: res.account, session: session });
          }
          return;
        }
        if (res.status === 'NEEDS_HANDLE') {
          if (typeof callback === 'function') {
            callback({
              ok: true,
              status: 'NEEDS_HANDLE',
              onboardingToken: res.onboardingToken,
              googleProfile: res.googleProfile
            });
          }
          return;
        }
        if (typeof callback === 'function') callback(res);
      })
      .catch(function (err) {
        if (typeof callback === 'function') callback({ ok: false, error: err.message || 'Network error verifying Google sign-in.' });
      });
  }

  function completeGoogleSignup(options, callback) {
    var apiBase = getCloudApiBase();
    var payload = {
      mode: 'complete',
      onboardingToken: options.onboardingToken,
      slug: (options.slug || options.username || '').trim().toLowerCase(),
      firstName: options.firstName || '',
      lastName: options.lastName || '',
      showRealName: options.showRealName !== false
    };

    fetch(apiBase + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res || !res.ok) {
          if (typeof callback === 'function') callback({ ok: false, error: (res && res.error) || 'Could not complete Google signup.' });
          return;
        }
        if (res.account) {
          var custom = getCustomAccounts();
          custom.push(normalizeAccountObject(res.account));
          saveCustomAccounts(custom);
          if (res.account.pfpUrl) {
            saveCustomProfile(res.account.slug, {
              displayName: res.account.name,
              firstName: res.account.firstName,
              lastName: res.account.lastName,
              showRealName: res.account.showRealName,
              bio: res.account.bio,
              division: res.account.division,
              pfpUrl: res.account.pfpUrl
            });
          }
        }
        var session = saveSessionObject(res.session || createSessionForAccount(res.account));
        if (typeof callback === 'function') {
          callback({ ok: true, status: 'AUTHENTICATED', account: res.account, session: session });
        }
      })
      .catch(function (err) {
        if (typeof callback === 'function') callback({ ok: false, error: err.message || 'Network error completing Google signup.' });
      });
  }

  function linkGoogleAccount(credentialOrToken, callback) {
    var current = getSession();
    if (!current || !current.slug) {
      if (typeof callback === 'function') callback({ ok: false, error: 'You must be signed in to link a Google account.' });
      return;
    }
    var payload = { mode: 'link', slug: current.slug };
    if (typeof credentialOrToken === 'string') {
      payload.credential = credentialOrToken;
    } else if (credentialOrToken && typeof credentialOrToken === 'object') {
      payload = Object.assign(payload, credentialOrToken);
    }

    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/auth/google', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body: JSON.stringify(payload)
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok && res.session) {
          saveSessionObject(res.session);
        }
        if (typeof callback === 'function') callback(res);
      })
      .catch(function (err) {
        if (typeof callback === 'function') callback({ ok: false, error: err.message || 'Failed to link Google account.' });
      });
  }

  function unlinkGoogleAccount(callback) {
    var current = getSession();
    if (!current || !current.slug) {
      if (typeof callback === 'function') callback({ ok: false, error: 'Not signed in.' });
      return;
    }
    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/auth/google', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
      body: JSON.stringify({ mode: 'unlink', slug: current.slug })
    })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (res && res.ok && res.session) {
          saveSessionObject(res.session);
        }
        if (typeof callback === 'function') callback(res);
      })
      .catch(function (err) {
        if (typeof callback === 'function') callback({ ok: false, error: err.message || 'Failed to unlink Google account.' });
      });
  }

  function getSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY) || getSharedCookie('mytyson_sso');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    setSharedCookie('mytyson_sso', '', -1);
  }

  function getCustomProfile(slug) {
    if (!slug) return {};
    try {
      var localRaw = localStorage.getItem(CUSTOM_KEY_PREFIX + slug);
      if (localRaw) {
        return JSON.parse(localRaw);
      }
    } catch (e) {}
    var chunked = readChunkedCookie(slug);
    if (chunked) return chunked;
    try {
      var fallbackCookie = getSharedCookie('mytyson_custom_' + slug);
      return fallbackCookie ? JSON.parse(fallbackCookie) : {};
    } catch (e) {
      return {};
    }
  }

  function saveCustomProfile(slug, data, onCloudSaved) {
    if (!slug) return;
    var payload = {
      slug: slug,
      displayName: data.displayName || '',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      showRealName: data.showRealName !== false,
      bio: data.bio || '',
      division: data.division || '',
      pfpUrl: data.pfpUrl || '',
      coverUrl: data.coverUrl || '',
      updatedAt: Date.now()
    };
    var raw = JSON.stringify(payload);
    try {
      localStorage.setItem(CUSTOM_KEY_PREFIX + slug, raw);
    } catch (e) {}

    if (raw.length <= CHUNK_COUNT * CHUNK_SIZE) {
      writeChunkedCookie(slug, raw);
    } else {
      var pfpPayload = JSON.stringify({
        slug: slug,
        displayName: payload.displayName,
        bio: payload.bio,
        division: payload.division,
        pfpUrl: payload.pfpUrl || '',
        coverUrl: (payload.coverUrl && !payload.coverUrl.startsWith('data:')) ? payload.coverUrl : '',
        updatedAt: payload.updatedAt
      });
      if (pfpPayload.length <= CHUNK_COUNT * CHUNK_SIZE) {
        writeChunkedCookie(slug, pfpPayload);
      }
    }

    var apiBase = getCloudApiBase();
    try {
      fetch(apiBase + '/api/profile?slug=' + encodeURIComponent(slug), {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, getAuthHeader()),
        body: raw
      })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (typeof onCloudSaved === 'function') onCloudSaved(true, res);
        })
        .catch(function () {
          if (typeof onCloudSaved === 'function') onCloudSaved(false);
        });
    } catch (e) {
      if (typeof onCloudSaved === 'function') onCloudSaved(false);
    }

    return payload;
  }

  function fetchCloudProfile(slug, callback) {
    if (!slug) return;
    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/profile?slug=' + encodeURIComponent(slug) + '&_t=' + Date.now())
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (cloudData) {
        if (cloudData && (cloudData.slug || cloudData.pfpUrl || cloudData.displayName || cloudData.updatedAt)) {
          var local = getCustomProfile(slug);
          if (!local.updatedAt || (cloudData.updatedAt && cloudData.updatedAt >= local.updatedAt) || (cloudData.pfpUrl && !local.pfpUrl)) {
            try {
              localStorage.setItem(CUSTOM_KEY_PREFIX + slug, JSON.stringify(cloudData));
            } catch (e) {}
            var rawJson = JSON.stringify(cloudData);
            if (rawJson.length <= CHUNK_COUNT * CHUNK_SIZE) {
              writeChunkedCookie(slug, rawJson);
            } else if (cloudData.pfpUrl) {
              var compact = JSON.stringify({
                slug: slug,
                displayName: cloudData.displayName || '',
                bio: cloudData.bio || '',
                division: cloudData.division || '',
                pfpUrl: cloudData.pfpUrl,
                updatedAt: cloudData.updatedAt
              });
              if (compact.length <= CHUNK_COUNT * CHUNK_SIZE) {
                writeChunkedCookie(slug, compact);
              }
            }
            if (typeof callback === 'function') callback(cloudData);
            return;
          }
        }
        if (typeof callback === 'function') callback(getCustomProfile(slug));
      })
      .catch(function () {
        if (typeof callback === 'function') callback(getCustomProfile(slug));
      });
  }

  function resetCustomProfile(slug, callback) {
    if (!slug) return;
    try {
      localStorage.removeItem(CUSTOM_KEY_PREFIX + slug);
    } catch (e) {}
    writeChunkedCookie(slug, '');
    setSharedCookie('mytyson_custom_' + slug, '', -1);

    var apiBase = getCloudApiBase();
    fetch(apiBase + '/api/profile?slug=' + encodeURIComponent(slug), {
      method: 'DELETE',
      headers: getAuthHeader()
    }).finally(function () {
      if (typeof callback === 'function') callback();
    });
  }

  function encodeSsoToken(session) {
    try {
      return btoa(JSON.stringify(session));
    } catch (e) {
      return '';
    }
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
      saved = localStorage.getItem(THEME_KEY) || getSharedCookie(THEME_KEY) || 'noir-aero';
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

  function syncMobileCommandBar() {
    var authBtn = document.getElementById('cmdBarAuthBtn');
    var profBtn = document.getElementById('cmdBarProfileBtn');
    if (!authBtn || !profBtn) return;

    var topAuth = document.getElementById('topAuthBtn');
    var adminSignOut = document.getElementById('adminSignOutBtn');
    var topProf = document.getElementById('topPublicProfileBtn');
    var session = getSession();
    var h = window.location.hostname;
    var isLocal = (h === 'localhost' || h === '127.0.0.1');
    var ssoBase = isLocal ? 'http://localhost:8097/auth.html' : 'https://auth.my.tysonmediagroup.org';
    var orgBase = isLocal ? 'http://localhost:8096' : 'https://tysonmediagroup.org';

    if (topAuth) {
      var label = (topAuth.textContent || '').trim() || 'Sign In';
      authBtn.textContent = label;
      authBtn.href = topAuth.getAttribute('href') || ssoBase;
      authBtn.onclick = function (e) {
        if (typeof topAuth.onclick === 'function') {
          e.preventDefault();
          topAuth.click();
        }
      };
    } else if (adminSignOut) {
      authBtn.textContent = session && session.slug ? ('Sign Out (' + session.slug + ')') : 'Sign Out';
      authBtn.href = '#';
      authBtn.onclick = function (e) {
        e.preventDefault();
        adminSignOut.click();
      };
    } else if (session && session.slug) {
      authBtn.textContent = 'Sign Out (' + session.slug + ')';
      authBtn.href = '#';
      authBtn.onclick = function (e) {
        e.preventDefault();
        clearSession();
        window.location.href = ssoBase + '?redirect=' + encodeURIComponent(window.location.href.split('?')[0]);
      };
    } else {
      authBtn.textContent = 'Sign In';
      authBtn.href = ssoBase + '?redirect=' + encodeURIComponent(window.location.href.split('?')[0]);
      authBtn.onclick = null;
    }

    if (topProf && topProf.getAttribute('href') && topProf.getAttribute('href') !== '#') {
      profBtn.href = topProf.getAttribute('href');
      profBtn.textContent = 'Public Profile';
    } else if (session && session.slug) {
      profBtn.href = orgBase + '/' + encodeURIComponent(session.slug);
      profBtn.textContent = 'Public Profile';
    } else {
      var pageSlug = document.body ? document.body.getAttribute('data-profile-slug') : '';
      if (pageSlug) {
        profBtn.href = orgBase + '/' + encodeURIComponent(pageSlug);
        profBtn.textContent = 'Public Profile';
      } else {
        profBtn.href = isLocal ? 'http://localhost:8097/' : 'https://my.tysonmediagroup.org/';
        profBtn.textContent = 'Public Profile';
      }
    }
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
        '<a href="https://tysonmediagroup.org" class="btn cmd-bar-btn" id="cmdBarProfileBtn" target="_blank" rel="noopener">Public Profile</a>' +
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

    syncMobileCommandBar();

    if (typeof MutationObserver !== 'undefined') {
      var obs = new MutationObserver(function () {
        syncMobileCommandBar();
      });
      var topAuth = document.getElementById('topAuthBtn');
      var topProf = document.getElementById('topPublicProfileBtn');
      if (topAuth) obs.observe(topAuth, { attributes: true, childList: true, characterData: true, subtree: true });
      if (topProf) obs.observe(topProf, { attributes: true });
    }
  }

  document.addEventListener('DOMContentLoaded', initThemeDrawer);

  window.MyTysonCore = {
    GOOGLE_CLIENT_ID: GOOGLE_CLIENT_ID,
    DEFAULT_ACCOUNTS: DEFAULT_ACCOUNTS,
    ACCOUNTS: DEFAULT_ACCOUNTS,
    isStaffMember: isStaffMember,
    formatAccountUsername: formatAccountUsername,
    formatDisplayHandle: formatDisplayHandle,
    getAllAccounts: getAllAccounts,
    findAccount: findAccount,
    authenticate: authenticate,
    authenticateWithGoogle: authenticateWithGoogle,
    completeGoogleSignup: completeGoogleSignup,
    linkGoogleAccount: linkGoogleAccount,
    unlinkGoogleAccount: unlinkGoogleAccount,
    createSessionForAccount: createSessionForAccount,
    getSession: getSession,
    clearSession: clearSession,
    isPowerAdmin: isPowerAdmin,
    createAccount: createAccount,
    updateAccount: updateAccount,
    deleteAccount: deleteAccount,
    syncAccountsFromCloud: syncAccountsFromCloud,
    getCustomProfile: getCustomProfile,
    saveCustomProfile: saveCustomProfile,
    fetchCloudProfile: fetchCloudProfile,
    resetCustomProfile: resetCustomProfile,
    encodeSsoToken: encodeSsoToken,
    applyTheme: applyTheme
  };
})(window);
