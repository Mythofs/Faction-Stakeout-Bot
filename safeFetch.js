async function safeFetch(url, channel) {
    let response;
    try {
        response = await fetch(url);
    } catch (error) {
        return null
    }
    let data;
    try {
        data = await response.json();
    } catch(error) {
        return null;
    }
    if (!response.ok) {
        return null;
    }
    return data;
}
module.exports = safeFetch;