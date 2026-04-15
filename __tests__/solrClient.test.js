jest.mock('axios', () => ({
    get: jest.fn(),
    post: jest.fn()
}));

const axios = require('axios');
const { isSolrEnabled, searchUserIds } = require('../utils/solrClient');

describe('utils/solrClient', () => {
    beforeEach(() => {
        axios.get.mockReset();
        axios.post.mockReset();
        delete process.env.SOLR_URL;
    });

    test('isSolrEnabled is false when SOLR_URL is not set', () => {
        expect(isSolrEnabled()).toBe(false);
    });

    test('searchUserIds throws when SOLR_URL is not set', async () => {
        await expect(searchUserIds('john')).rejects.toThrow('Solr is not enabled');
    });

    test('searchUserIds queries Solr and returns ids + total', async () => {
        process.env.SOLR_URL = 'http://localhost:8983/solr';

        axios.get.mockResolvedValueOnce({
            data: {
                response: {
                    numFound: 2,
                    docs: [{ id: 'u1', score: 1.2 }, { id: 'u2', score: 0.9 }]
                }
            }
        });

        const result = await searchUserIds('john', { start: 0, rows: 20, role: 'all', status: 'all' });

        expect(result).toEqual({ ids: ['u1', 'u2'], total: 2 });

        expect(axios.get).toHaveBeenCalledTimes(1);
        const [url, config] = axios.get.mock.calls[0];
        expect(url).toBe('http://localhost:8983/solr/users/select');
        expect(config.params.defType).toBe('edismax');
        expect(config.params.q).toBe('john');
        expect(config.params.fq).toEqual(['-role_s:ADMIN']);
    });

    test('searchUserIds normalizes role/status filters (case-insensitive)', async () => {
        process.env.SOLR_URL = 'http://localhost:8983/solr';

        axios.get.mockResolvedValueOnce({
            data: {
                response: {
                    numFound: 0,
                    docs: []
                }
            }
        });

        await searchUserIds('alice', { role: 'PASSENGER', status: 'active' });

        const [, config] = axios.get.mock.calls[0];
        expect(config.params.fq).toEqual([
            '-role_s:ADMIN',
            'role_s:"PASSENGER"',
            'accountStatus_s:"ACTIVE"'
        ]);
    });
});
