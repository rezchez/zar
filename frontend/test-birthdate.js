const state = { birthDate: "1370/05/12" };
const parts = (state.birthDate && typeof state.birthDate === 'string' && state.birthDate !== 'undefined' ? String(state.birthDate) : '//').split('/');
console.log(parts);
