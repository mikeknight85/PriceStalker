import jwt from 'jsonwebtoken';

const token = jwt.sign(
  { userId: 1 }, // Note: the backend Auth middleware checks req.userId from the payload
  'f5d26b380fca399a5459bd43c234c272ed5bb53ecfa760934dee70fd427adf1e',
  { expiresIn: '1h' }
);
console.log(token);
