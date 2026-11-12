/* ============================================================
   DoLadu — сторінка продукту
   Три речі: поява при скролі, заглушки для скріншотів, дрібниці шапки.
   Ніякої залежності від бібліотек.
   ============================================================ */
(function () {
    'use strict';

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------- 1. ПОЯВА ПРИ СКРОЛІ ----------
       IntersectionObserver, а не обробник scroll: браузер сам вирішує,
       коли рахувати, і це не гальмує довгу сторінку.                */
    var revealables = document.querySelectorAll('.reveal');

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

        document.querySelectorAll('[data-count], .perf__fill').forEach(function (el) { once.observe(el); });
    }

    /* ---------- 1b. ЗАПОБІЖНИК ----------
       Спостерігач може не спрацювати: старий движок, помилка вище по коду,
       нестандартний контейнер прокрутки. Текст не має лишитись невидимим,
       тому дублюємо простою перевіркою на скролі — вона дешева, бо кожен
       елемент показується один раз і більше не перевіряється.            */
    /* Запобіжник тільки ПОКАЗУЄ і ніколи не ховає: інакше він сперечався б
       зі спостерігачами на межі й повертав те саме тремтіння. */
    function revealVisible() {
        var vh = window.innerHeight;
        for (var i = revealables.length - 1; i >= 0; i--) {
            var el = revealables[i];
            if (el.classList.contains('is-in')) continue;
            var r = el.getBoundingClientRect();
            if (r.top < vh * 0.88 && r.bottom > vh * 0.10) el.classList.add('is-in');
        }
    }
    if (!reduced) {
        // Тротлимо ЧАСОМ, а не requestAnimationFrame: rAF не виконується,
        // поки вкладка не малюється, і саме тоді запобіжник найпотрібніший.
        var lastRun = 0;
        window.addEventListener('scroll', function () {
            var now = Date.now();
            if (now - lastRun < 120) return;
            lastRun = now;
            revealVisible();
        }, { passive: true });
        setTimeout(revealVisible, 2500);
        window.addEventListener('load', revealVisible);
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
        document.querySelectorAll('[data-count]').forEach(function (el) {
            el.textContent = el.getAttribute('data-count');
        });
    }
    function fillBars() {
        document.querySelectorAll('.perf__fill').forEach(function (el) {
            el.style.width = el.getAttribute('data-w') + '%';
        });
    }

    /* ---------- 3. ЗАГЛУШКИ ДЛЯ СКРІНШОТІВ ----------
       Поки файлу в assets/shots/ немає, показуємо рамку з іменем файлу,
       який туди треба покласти. Розкладку й рух видно вже зараз, а коли
       з'являться справжні скріншоти — нічого міняти не доведеться.     */
    document.querySelectorAll('figure.shot').forEach(function (fig) {
        var img = fig.querySelector('img');
        if (!img) return;
        if (img.complete && img.naturalWidth > 0) return;      // вже завантажилось
        img.addEventListener('error', function () { fig.classList.add('is-empty'); });
        if (img.complete && img.naturalWidth === 0) fig.classList.add('is-empty');
    });

    /* ---------- 3b. ШТОРКИ З ХЕШТЕГАМИ ----------
       Висоту рахуємо в пікселях, бо height:auto не анімується.
       Відкрита завжди одна: клік по іншій закриває попередню.      */
    var accItems = [].slice.call(document.querySelectorAll('.acc__item'));

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

    // Після зміни ширини висота тексту інша — перераховуємо відкриту
    window.addEventListener('resize', function () {
        accItems.forEach(function (item) {
            if (item.classList.contains('is-open')) setPanel(item, true);
        });
    });

    /* ---------- 3c. ВКЛАДКИ: одне зображення за раз ----------
       Текст прокручується, картинка стоїть (sticky) і змінюється:
       попередня гасне, наступна напливає справа.
       Активний — крок, у який зараз потрапляє середина екрана (кроки
       йдуть впритул, тож це однозначно й без стрибків на межах).
       У довгому кроці два знімки: перша половина кроку — data-sub 0,
       друга — data-sub 1. Разом із кроком перемикається вкладка
       в смузі над секцією.                                          */
    var wsSteps  = [].slice.call(document.querySelectorAll('.ws__step'));
    var wsShots  = [].slice.call(document.querySelectorAll('.ws__shot'));
    var wsTabs   = [].slice.call(document.querySelectorAll('.ws-tabs__tab'));

    if (wsSteps.length && wsShots.length) {
        var wsKey = '';

        function wsUpdate() {
            var mid = window.innerHeight * 0.5;
            var best = -1, bestDist = Infinity, sub = 0;
            for (var i = 0; i < wsSteps.length; i++) {
                var r = wsSteps[i].getBoundingClientRect();
                if (r.top <= mid && r.bottom > mid) { best = i; break; }
                var dist = Math.min(Math.abs(r.top - mid), Math.abs(r.bottom - mid));
                if (dist < bestDist) { bestDist = dist; best = i; }
            }
            var step = wsSteps[best];
            var count = wsShots.filter(function (el) {
                return el.getAttribute('data-i') === String(best);
            }).length;
            if (count > 1) {
                /* Знімки ділять між собою лише той шлях, поки текст пришпилений:
                   від моменту, коли верх кроку дійшов до середини екрана, і до
                   того, як текст відпустить. Інакше останній знімок міняється
                   вже після того, як текст виїхав. */
                var rs  = step.getBoundingClientRect();
                var pin = step.querySelector('.ws__pin');
                var travel = rs.height - (pin ? pin.offsetHeight : 0);
                var prog = travel > 0 ? (mid - rs.top) / travel : 0;
                sub = Math.max(0, Math.min(count - 1, Math.floor(prog * count)));
            }

            var key = best + ':' + sub;
            if (key === wsKey) return;
            wsKey = key;
            wsSteps.forEach(function (el, i) { el.classList.toggle('is-active', i === best); });
            wsShots.forEach(function (el) {
                el.classList.toggle('is-active',
                    el.getAttribute('data-i') === String(best) &&
                    (el.getAttribute('data-sub') || '0') === String(sub));
            });
            wsTabs.forEach(function (el) {
                var on = el.getAttribute('data-i') === String(best);
                el.classList.toggle('is-active', on);
                if (on) el.setAttribute('aria-current', 'true'); else el.removeAttribute('aria-current');
            });
        }

        var wsPending = 0;
        window.addEventListener('scroll', function () {
            var now = Date.now();
            if (now - wsPending < 90) return;
            wsPending = now;
            wsUpdate();
        }, { passive: true });
        // Останній кадр після зупинки скролу — щоб тротлінг не «проковтнув» зміну
        var wsIdle = 0;
        window.addEventListener('scroll', function () {
            clearTimeout(wsIdle);
            wsIdle = setTimeout(wsUpdate, 140);
        }, { passive: true });
        window.addEventListener('resize', wsUpdate);
        wsUpdate();
    }

    /* ---------- 3d. ЗНІМКИ ПО ЧЕРЗІ (не вкладки) ----------
       Сцена пришпилена по центру, доки під нею їде доріжка [data-swap];
       знімки ділять між собою шлях, поки сцена стоїть. На вузькому екрані
       сцена звичайна (position не sticky) — тоді показано всі підряд.   */
    var swaps = [].slice.call(document.querySelectorAll('[data-swap]'));
    function swapUpdate() {
        swaps.forEach(function (track) {
            var stage = track.querySelector('.swap__stage');
            var shots = [].slice.call(track.querySelectorAll('.swap-shot'));
            if (!stage || shots.length < 2) return;
            if (getComputedStyle(stage).position !== 'sticky') return;
            var r = track.getBoundingClientRect();
            var travel = r.height - stage.offsetHeight;
            var p = travel > 0 ? (window.innerHeight / 2 - r.top) / travel : 0;
            var k = Math.max(0, Math.min(shots.length - 1, Math.floor(p * shots.length)));
            shots.forEach(function (el, i) { el.classList.toggle('is-active', i === k); });
        });
    }
    if (swaps.length) {
        var swapLast = 0, swapIdle = 0;
        window.addEventListener('scroll', function () {
            var now = Date.now();
            clearTimeout(swapIdle);
            swapIdle = setTimeout(swapUpdate, 140);
            if (now - swapLast < 90) return;
            swapLast = now;
            swapUpdate();
        }, { passive: true });
        window.addEventListener('resize', swapUpdate);
        swapUpdate();
    }

    /* ---------- 4. ШАПКА: підкладка після скролу ---------- */
    var topbar = document.getElementById('topbar');
    if (topbar) {
        var ticking = false;
        function onScroll() {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                topbar.classList.toggle('is-stuck', window.scrollY > 40);
                ticking = false;
            });
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ---------- 5. ЗУМ СКРІНШОТА ----------
       Клік по знімку відкриває його на весь екран; ще клік — у натуральному
       розмірі, з прокруткою. Esc, ✕ або клік повз знімок — закрити.
       Показуємо той самий файл, що й на сторінці: окремого «великого» немає. */
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
            '<span class="zoom__hint">Click to zoom &middot; Esc to close</span></div>';
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
            img.src = src.currentSrc || src.src;
            img.alt = src.alt || '';
            var fc = fig.querySelector('figcaption');
            cap.innerHTML = fc ? fc.innerHTML : '';
            box.classList.remove('is-full');
            box.classList.add('is-open');
            document.documentElement.style.overflow = 'hidden';
            scroller.scrollTop = 0; scroller.scrollLeft = 0;
            closeBtn.focus();
        }
        function close() {
            box.classList.remove('is-open', 'is-full');
            document.documentElement.style.overflow = '';
            img.removeAttribute('src');
            if (opener && opener.focus) opener.focus();
        }

        document.addEventListener('click', function (e) {
            var t = e.target;
            if (t.closest && t.closest('.zoom')) return;
            var fig = t.closest && t.closest('.shot');
            if (fig && fig.querySelector('img') && t.tagName === 'IMG') open(fig);
        });
        img.addEventListener('click', function (e) {
            e.stopPropagation();
            var full = box.classList.toggle('is-full');
            if (full) {
                // відкрити з центру знімка, а не з лівого верхнього кута
                scroller.scrollLeft = (scroller.scrollWidth - scroller.clientWidth) / 2;
                scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) / 2;
            }
        });
        scroller.addEventListener('click', function (e) { if (e.target === scroller) close(); });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && box.classList.contains('is-open')) close();
        });
    })();
})();
