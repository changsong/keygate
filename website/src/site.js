(() => {
  const toggle = document.querySelector('[data-mobile-toggle]');
  const menu = document.querySelector('[data-mobile-menu]');
  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  document.querySelectorAll('[data-billing]').forEach((group) => {
    const buttons = group.querySelectorAll('button[data-period]');
    const priceEls = document.querySelectorAll('[data-price-monthly]');
    const billedEls = document.querySelectorAll('[data-billed]');

    const apply = (period) => {
      buttons.forEach((b) => b.classList.toggle('active', b.dataset.period === period));
      priceEls.forEach((el) => {
        const monthly = el.dataset.priceMonthly;
        const yearly = el.dataset.priceYearly;
        el.textContent = period === 'yearly' ? yearly : monthly;
      });
      billedEls.forEach((el) => {
        el.textContent = period === 'yearly' ? el.dataset.billedYearly : el.dataset.billedMonthly;
      });
    };

    buttons.forEach((button) => {
      button.addEventListener('click', () => apply(button.dataset.period));
    });
  });

  document.querySelectorAll('.codeblock').forEach((block) => {
    const button = block.querySelector('.copy-btn');
    const code = block.querySelector('pre code') || block.querySelector('pre');
    if (!button || !code) return;
    button.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        button.textContent = button.dataset.copied || 'Copied';
        setTimeout(() => {
          button.textContent = button.dataset.copy || 'Copy';
        }, 1600);
      } catch {
        button.textContent = 'Copy failed';
      }
    });
  });

  const apiFilter = document.querySelector('[data-api-filter]');
  if (apiFilter) {
    apiFilter.addEventListener('input', () => {
      const query = apiFilter.value.trim().toLowerCase();
      document.querySelectorAll('[data-api]').forEach((node) => {
        node.style.display = !query || node.dataset.api.includes(query) ? '' : 'none';
      });
    });
  }

  const form = document.querySelector('[data-contact-form]');
  if (form) {
    const planParam = new URLSearchParams(window.location.search).get('plan');
    if (planParam) {
      const select = form.querySelector('select[name="plan"]');
      if (select) select.value = planParam;
    }
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(form);
      const email = String(data.get('email') || '').trim();
      const name = String(data.get('name') || '').trim();
      const company = String(data.get('company') || '').trim();
      const plan = String(data.get('plan') || '').trim();
      const message = String(data.get('message') || '').trim();
      const subject = encodeURIComponent(`[UnionUser] ${plan || 'Demo'} · ${company || name || email}`);
      const body = encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\nCompany: ${company}\nPlan: ${plan}\n\n${message}`,
      );
      const target = form.dataset.mailto || 'sales@unionuser.com';
      window.location.href = `mailto:${target}?subject=${subject}&body=${body}`;
      const note = form.querySelector('[data-form-note]');
      if (note) note.textContent = note.dataset.sentText || note.textContent;
    });
  }
})();
