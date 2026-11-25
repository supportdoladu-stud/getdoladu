/* ============================================================
   DoLadu — сторінка продукту
   Поява при скролі, рух, прив'язаний до скролу, галереї, зум, вкладки.
   Ніякої залежності від бібліотек.
   ============================================================ */
(function () {
    'use strict';

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };

    /* ---------- 1. ПОЯВА ПРИ СКРОЛІ ----------
       IntersectionObserver, а не обробник scroll: браузер сам вирішує,
       коли рахувати, і це не гальмує довгу сторінку.                */
    var revealables = $$('.reveal');

    if (reduced || !('IntersectionObserver' in window)) {
        // Без анімації: просто показуємо все одразу
        revealables.forEach(function (el) { el.classList.add('is-in'); });
        runCounters();
        fillBars();
    } else {
        /* Два спостерігачі з РІЗНИМИ смугами — це і є захист від тремтіння.
           Показ вмикається у вужчій смузі, а вимикається лише коли елемент
           вийшов за ширшу. Між ними мертва зона, де нічого не змінюється,
           тому рядок на межі екрана більше не блимає туди-сюди.          */
        var ioShow = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) entry.target.classList.add('is-in');
            });
        }, { rootMargin: '-10% 0px -12% 0px', threshold: 0 });

        var ioHide = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) entry.target.classList.remove('is-in');
            });
        }, { rootMargin: '14% 0px 14% 0px', threshold: 0 });

        revealables.forEach(function (el) { ioShow.observe(el); ioHide.observe(el); });

        /* Лічильники й смуги запускаємо, коли їхній блок видно */
        var once = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var el = entry.target;
                if (entry.isIntersecting) {
                    if (el.hasAttribute('data-count')) countUp(el);
                    if (el.classList.contains('perf__fill')) el.style.width = el.getAttribute('data-w') + '%';
                } else {
                    // Скидаємо, щоб при поверненні цифри й смуги зіграли знову
                    if (el.hasAttribute('data-count')) el.textContent = '0';
                    if (el.classList.contains('perf__fill')) el.style.width = '0%';
                }
            });
        }, { threshold: 0.5 });

        // смугу спостерігаємо по її доріжці: сама вона спершу нульової ширини
        $$('[data-count]').forEach(function (el) { once.observe(el); });
        var bars = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                var f = entry.target.querySelector('.perf__fill');
                if (f) f.style.width = entry.isIntersecting ? f.getAttribute('data-w') + '%' : '0%';
            });
        }, { threshold: 0.5 });
        $$('.perf__track').forEach(function (el) { bars.observe(el); });
    }

    /* ---------- 1b. ЗАПОБІЖНИК ----------
       Спостерігач може не спрацювати: старий движок, помилка вище по коду,
       нестандартний контейнер прокрутки. Текст не має лишитись невидимим,
       тому дублюємо простою перевіркою на скролі. Він тільки ПОКАЗУЄ і ніколи
       не ховає: інакше сперечався б зі спостерігачами на межі.            */
    function revealVisible() {
        var vh = window.innerHeight;
        for (var i = revealables.length - 1; i >= 0; i--) {
            var el = revealables[i];
            if (el.classList.contains('is-in')) continue;
            var r = el.getBoundingClientRect();
            if (r.top < vh * 0.88 && r.bottom > vh * 0.10) el.classList.add('is-in');
        }
    }

    /* ---------- 2. ЛІЧИЛЬНИК ОЦІНКИ ---------- */
    function countUp(el) {
        var target = parseInt(el.getAttribute('data-count'), 10) || 0;
        var start = null, dur = 1100;
        function step(ts) {
            if (start === null) start = ts;
            var p = Math.min((ts - start) / dur, 1);
            // ease-out: швидко стартує, м'яко гальмує
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    function runCounters() {
        $$('[data-count]').forEach(function (el) { el.textContent = el.getAttribute('data-count'); });
    }
    function fillBars() {
        $$('.perf__fill').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
    }

    /* ---------- 3. РУХ, ПРИВ'ЯЗАНИЙ ДО СКРОЛУ ----------
       Кожен [data-p] отримує --p від 0 до 1: 0, коли його верх на висоті
       data-start (частка екрана), 1 — на data-end. Далі все робить CSS.
       Прокрутив назад — анімація йде назад. Без JS --p = 1, усе на місці. */
    var movers = $$('[data-p]').map(function (el) {
        return {
            el: el, last: -1,
            start: parseFloat(el.getAttribute('data-start')) || 0.98,
            end: parseFloat(el.getAttribute('data-end')) || 0.55
        };
    });
    function moveUpdate() {
        var vh = window.innerHeight;
        var maxScroll = document.documentElement.scrollHeight - vh;
        movers.forEach(function (m) {
            var top = m.el.getBoundingClientRect().top;
            var p = (vh * m.start - top) / (vh * (m.start - m.end));
            // біля самого низу сторінки доїхати нікуди — вважаємо, що приїхали
            if (maxScroll - window.scrollY < 4 && top < vh) p = 1;
            p = Math.max(0, Math.min(1, p));
            p = Math.round((1 - Math.pow(1 - p, 2)) * 1000) / 1000;      // м'яке гальмування
            if (p !== m.last) { m.last = p; m.el.style.setProperty('--p', p); }
        });
    }

    /* ---------- 4. ШАПКА ----------
       Спершу в ній лінки з футера; коли доходимо до «The problem was never
       the modelling», вони йдуть, а з'являється Get DoLadu.               */
    var topbar = document.getElementById('topbar');
    var problem = document.getElementById('problem');
    function topUpdate() {
        if (!topbar) return;
        topbar.classList.toggle('is-stuck', window.scrollY > 40);
        if (problem) {
            var mark = problem.querySelector('.kicker') || problem;
            topbar.classList.toggle('is-cta', mark.getBoundingClientRect().top < window.innerHeight * 0.75);
        }
    }

    /* ---------- 5. ВКЛАДКИ ВОРКСПЕЙСІВ: підсвічуємо той, що на екрані ---------- */
    var wsSteps = $$('.ws__step');
    var wsTabs  = $$('.ws-tabs__tab');
    function tabUpdate() {
        if (!wsSteps.length) return;
        var mid = window.innerHeight * 0.5, best = 0, bestDist = Infinity;
        wsSteps.forEach(function (el, i) {
            var r = el.getBoundingClientRect();
            var d = r.top <= mid && r.bottom > mid ? 0 : Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
            if (d < bestDist) { bestDist = d; best = i; }
        });
        wsTabs.forEach(function (el) {
            var on = el.getAttribute('data-i') === String(best);
            el.classList.toggle('is-active', on);
            if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
        });
    }

    var frame = 0, idle = 0;
    function onScrollNow() { frame = 0; topUpdate(); tabUpdate(); if (!reduced) moveUpdate(); }
    function onScroll() {
        if (!frame) frame = requestAnimationFrame(onScrollNow);
        // дублер на випадок, коли вкладка не малюється й rAF мовчить
        clearTimeout(idle);
        idle = setTimeout(function () { if (frame) { cancelAnimationFrame(frame); } onScrollNow(); if (!reduced) revealVisible(); }, 120);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    window.addEventListener('load', onScroll);
    onScrollNow();
    if (!reduced) setTimeout(revealVisible, 2500);

    /* ---------- 6. ГАЛЕРЕЇ ----------
       Кілька знімків — кнопки ‹ ›, крапки й свайп. Прокрутка сторінки їх не чіпає. */
    function eager(img) { if (img && img.loading === 'lazy') img.loading = 'eager'; }

    $$('.gallery').forEach(function (g) {
        var shots = $$('.shot', g);
        if (!shots.length) return;
        var view = document.createElement('div');
        view.className = 'gallery__view';
        g.insertBefore(view, shots[0]);
        shots.forEach(function (f) { view.appendChild(f); });
        var at = 0, dots = [];

        function show(n) {
            at = (n + shots.length) % shots.length;
            shots.forEach(function (f, i) {
                f.classList.toggle('is-active', i === at);
                f.classList.toggle('is-before', i < at);
            });
            dots.forEach(function (d, i) { d.classList.toggle('is-on', i === at); });
            eager(shots[at].querySelector('img'));
            eager(shots[(at + 1) % shots.length].querySelector('img'));
        }

        if (shots.length > 1) {
            var nav = document.createElement('div');
            nav.className = 'gallery__nav';
            nav.innerHTML =
                '<button class="gallery__btn" type="button" aria-label="Previous screenshot">&#8249;</button>' +
                '<span class="gallery__dots" aria-hidden="true">' + shots.map(function () { return '<i></i>'; }).join('') + '</span>' +
                '<button class="gallery__btn" type="button" aria-label="Next screenshot">&#8250;</button>';
            g.appendChild(nav);
            var btns = $$('.gallery__btn', nav);
            dots = $$('i', nav);
            btns[0].addEventListener('click', function () { show(at - 1); });
            btns[1].addEventListener('click', function () { show(at + 1); });
            g.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowLeft') show(at - 1);
                if (e.key === 'ArrowRight') show(at + 1);
            });
            var x0 = null, y0 = 0, swiped = false;
            view.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; swiped = false; }, { passive: true });
            view.addEventListener('touchend', function (e) {
                if (x0 === null) return;
                var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
                x0 = null;
                if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) { swiped = true; show(at + (dx < 0 ? 1 : -1)); }
            }, { passive: true });
            // свайп не має відкривати зум
            view.addEventListener('click', function (e) { if (swiped) { e.stopPropagation(); swiped = false; } }, true);
        }
        shots[0].classList.add('is-active');
        dots.forEach(function (d, i) { d.classList.toggle('is-on', i === 0); });

        /* Підвантажуємо перший і наступний знімки заздалегідь — за півтора екрана */
        if ('IntersectionObserver' in window) {
            var near = new IntersectionObserver(function (entries) {
                if (!entries[0].isIntersecting) return;
                eager(shots[at].querySelector('img'));
                if (shots[1]) eager(shots[1].querySelector('img'));
                near.disconnect();
            }, { rootMargin: '150% 0px 150% 0px' });
            near.observe(g);
        }
    });

    /* ---------- 7. ЗАГЛУШКИ ДЛЯ СКРІНШОТІВ ---------- */
    $$('figure.shot').forEach(function (fig) {
        var img = fig.querySelector('img');
        if (!img) return;
        if (img.complete && img.naturalWidth > 0) return;
        img.addEventListener('error', function () { fig.classList.add('is-empty'); });
    });

    /* ---------- 8. ШТОРКИ З ХЕШТЕГАМИ ----------
       Висоту рахуємо в пікселях, бо height:auto не анімується.
       Відкрита завжди одна: клік по іншій закриває попередню.      */
    var accItems = $$('.acc__item');

    function setPanel(item, open) {
        var panel = item.querySelector('.acc__panel');
        var head  = item.querySelector('.acc__head');
        if (!panel) return;
        item.classList.toggle('is-open', open);
        if (head) head.setAttribute('aria-expanded', open ? 'true' : 'false');
        panel.style.height = open ? (panel.firstElementChild.offsetHeight + 'px') : '0px';
    }

    accItems.forEach(function (item) {
        var head = item.querySelector('.acc__head');
        if (!head) return;
        setPanel(item, item.classList.contains('is-open'));
        head.addEventListener('click', function () {
            var willOpen = !item.classList.contains('is-open');
            accItems.forEach(function (other) { if (other !== item) setPanel(other, false); });
            setPanel(item, willOpen);
        });
    });

    // Після зміни ширини (і коли доїхали шрифти) висота тексту інша
    function refitPanels() {
        accItems.forEach(function (item) {
            if (item.classList.contains('is-open')) setPanel(item, true);
        });
    }
    window.addEventListener('resize', refitPanels);
    window.addEventListener('load', refitPanels);

    /* ---------- 9. ЗУМ СКРІНШОТА ----------
       Клік по знімку відкриває його на весь екран, одним кліком. Esc, ✕ або клік
       будь-де — закрити. Тут завжди повний jpg із src, а не легкий webp. */
    (function () {
        var box = document.createElement('div');
        box.className = 'zoom';
        box.setAttribute('role', 'dialog');
        box.setAttribute('aria-modal', 'true');
        box.setAttribute('aria-label', 'Screenshot');
        box.innerHTML =
            '<button class="zoom__close" type="button" aria-label="Close">&times;</button>' +
            '<div class="zoom__scroll"><img class="zoom__img" alt=""></div>' +
            '<div class="zoom__bar"><span class="zoom__cap"></span>' +
            '<span class="zoom__hint">Click or Esc to close</span></div>';
        document.body.appendChild(box);

        var img = box.querySelector('.zoom__img');
        var cap = box.querySelector('.zoom__cap');
        var scroller = box.querySelector('.zoom__scroll');
        var closeBtn = box.querySelector('.zoom__close');
        var opener = null;

        function open(fig) {
            var src = fig.querySelector('img');
            if (!src) return;
            opener = document.activeElement;
            img.src = src.getAttribute('src');
            img.alt = src.alt || '';
            var fc = fig.querySelector('figcaption');
            cap.innerHTML = fc ? fc.innerHTML : '';
            box.classList.add('is-open');
            document.documentElement.style.overflow = 'hidden';
            scroller.scrollTop = 0; scroller.scrollLeft = 0;
            closeBtn.focus();
        }
        function close() {
            box.classList.remove('is-open');
            document.documentElement.style.overflow = '';
            img.removeAttribute('src');
            if (opener && opener.focus) opener.focus({ preventScroll: true });
        }

        document.addEventListener('click', function (e) {
            var t = e.target;
            if (t.closest && t.closest('.zoom')) return;
            var fig = t.closest && t.closest('.shot');
            if (fig && fig.querySelector('img') && t.tagName === 'IMG') open(fig);
        });
        img.addEventListener('click', function (e) { e.stopPropagation(); close(); });
        scroller.addEventListener('click', close);
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && box.classList.contains('is-open')) close();
        });
    })();

    /* ---------- 10. UPDATES: ВКЛАДКИ ВЕРСІЙ ----------
       Кнопки 1.0.3 / 1.0.3a / 1.0.4 вгорі, під ними панель зі списком обраної.
       Стрілки ← → перемикають; #updates-1.0.3a у посиланні відкриває потрібну. */
    (function () {
        var tabs = $$('.upd-tab');
        if (!tabs.length) return;
        function show(tab, focus) {
            tabs.forEach(function (t) {
                var on = t === tab;
                t.classList.toggle('is-active', on);
                t.setAttribute('aria-selected', on ? 'true' : 'false');
                t.setAttribute('tabindex', on ? '0' : '-1');
                var p = document.getElementById(t.getAttribute('aria-controls'));
                if (p) p.hidden = !on;
            });
            if (focus) tab.focus();
        }
        tabs.forEach(function (t, i) {
            t.addEventListener('click', function () { show(t, false); });
            t.addEventListener('keydown', function (e) {
                var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
                if (n < 0 || n >= tabs.length) return;
                e.preventDefault();
                show(tabs[n], true);
            });
        });
        var m = /^#updates-(.+)$/.exec(location.hash);
        if (m) {
            var want = tabs.filter(function (t) { return t.getAttribute('data-v') === decodeURIComponent(m[1]); })[0];
            if (want) { show(want, false); var s = document.getElementById('whats-new'); if (s) s.scrollIntoView(); }
        } else {
            show(tabs.filter(function (t) { return t.classList.contains('is-active'); })[0] || tabs[tabs.length - 1], false);
        }
    })();
})();
