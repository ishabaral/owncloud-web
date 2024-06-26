export class HttpError extends Error {
  public response: Response
  public statusCode: number

  constructor(message: string, response: Response, statusCode: number = null) {
    super(message)
    this.response = response
    this.statusCode = statusCode
  }
}
