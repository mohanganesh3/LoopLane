const { AppError, notFound, errorHandler, asyncHandler } = require('../middleware/errorHandler')

function mockRes() {
    const res = {}
    res.status = jest.fn(() => res)
    res.json = jest.fn(() => res)
    res.end = jest.fn(() => res)
    return res
}

describe('middleware/errorHandler', () => {
    let consoleError

    beforeEach(() => {
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        consoleError.mockRestore()
    })

    test('notFound returns 204 for favicon.ico', () => {
        const req = { originalUrl: '/favicon.ico', method: 'GET' }
        const res = mockRes()
        const next = jest.fn()

        notFound(req, res, next)

        expect(res.status).toHaveBeenCalledWith(204)
        expect(res.end).toHaveBeenCalled()
        expect(next).not.toHaveBeenCalled()
    })

    test('notFound returns JSON 404 for unknown API route', () => {
        const req = { originalUrl: '/api/does-not-exist', method: 'GET' }
        const res = mockRes()
        const next = jest.fn()

        notFound(req, res, next)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            code: 'ROUTE_NOT_FOUND',
            path: '/api/does-not-exist',
            method: 'GET'
        }))
        expect(next).not.toHaveBeenCalled()
    })

    test('notFound calls next(AppError) for non-API routes', () => {
        const req = { originalUrl: '/some-page', method: 'GET' }
        const res = mockRes()
        const next = jest.fn()

        notFound(req, res, next)

        expect(next).toHaveBeenCalledTimes(1)
        const [err] = next.mock.calls[0]
        expect(err).toBeInstanceOf(AppError)
        expect(err).toEqual(expect.objectContaining({ statusCode: 404 }))
    })

    test('errorHandler normalizes CastError to 404', () => {
        const req = { method: 'GET', originalUrl: '/api/rides/123' }
        const res = mockRes()

        errorHandler({ name: 'CastError', message: 'bad id', stack: 'stack' }, req, res)

        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Resource not found',
            error: {}
        }))
    })

    test('errorHandler normalizes duplicate key (11000) to 400', () => {
        const req = { method: 'POST', originalUrl: '/api/auth/register' }
        const res = mockRes()

        errorHandler({ code: 11000, keyValue: { email: 'a@b.com' }, message: 'dup' }, req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'This email is already registered'
        }))
    })

    test('errorHandler normalizes ValidationError to 400 and joins messages', () => {
        const req = { method: 'POST', originalUrl: '/api/auth/register' }
        const res = mockRes()

        errorHandler({
            name: 'ValidationError',
            errors: {
                email: { message: 'Email required' },
                password: { message: 'Password required' }
            },
            message: 'validation'
        }, req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Email required, Password required'
        }))
    })

    test('errorHandler normalizes invalid JSON SyntaxError to 400', () => {
        const req = { method: 'POST', originalUrl: '/api/anything' }
        const res = mockRes()
        const err = new SyntaxError('Unexpected token')
        err.status = 400
        err.body = '...'

        errorHandler(err, req, res)

        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: '❌ Invalid data format. Please check your input and try again.'
        }))
    })

    test('asyncHandler forwards async errors to next', async () => {
        const boom = new Error('boom')
        const fn = async () => {
            throw boom
        }

        const wrapped = asyncHandler(fn)
        const next = jest.fn()

        wrapped({}, {}, next)
        await new Promise((resolve) => setImmediate(resolve))

        expect(next).toHaveBeenCalledWith(boom)
    })
})
