async function main() {
  const res = await fetch('https://www.rna.gov.it/sites/rna.mise.gov.it/files/opendata/OpenData_Aiuti_2026_08.xml');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let data = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    data += decoder.decode(value, { stream: true });
    if (data.length > 50000) break;
  }
  data += decoder.decode();
  console.log(data);
}
main();
